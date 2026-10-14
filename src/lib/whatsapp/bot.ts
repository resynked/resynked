import { AiKeyError, openAi, pastQuoteLines, type QuoteProposal } from '@/lib/ai';
import { emptyElement } from '@/lib/blocks';
import { createCustomer, createQuote, dagenErbij, getTenant, takeDocumentNumber, updateCustomer, vandaagHier } from '@/lib/db';
import { appUrl } from '@/lib/email';
import { plainTextToRichText } from '@/lib/richtext';
import { supabaseAdmin } from '@/lib/supabase';
import type { Customer, DocumentBlock } from '@/lib/supabase';
import { calculateDocumentTotal, formatCurrency, getCustomerDisplayName, getCustomerPersonName, lineTotal } from '@/lib/utils';
import { findAccountByPhone, markReadAndTyping, sendText, setPending, type WhatsAppAccountRow } from './index';

/**
 * Wat de bot met een binnengekomen bericht doet.
 *
 * De gebruiker stuurt vanaf zijn eigen telefoon wat hij bij de klant ziet of
 * opmeet, zoals "keuken 25m2 muren schilderen, klant Jan de Vries, Dorpsstraat
 * 1 Utrecht". De AI leest daar de klant en de regels uit; bestaat de klant al,
 * dan gebruiken we die, anders komt er een nieuwe klant. De offerte komt als
 * concept klaar te staan, en de gebruiker krijgt een samenvatting met een link
 * terug.
 */

/** Zo lang wacht een bericht zonder klant op het volgende bericht dat hem noemt. */
const PENDING_MINUTES = 60;

const CANCEL_PATTERN = /^\s*(stop|annuleer|annuleren|wis)\s*[.!]?\s*$/i;
const HELP_PATTERN = /^\s*(help|hulp|\?)\s*$/i;

const HELP_TEXT = `Stuur me wat je bij de klant ziet of opmeet, dan zet ik een conceptofferte voor je klaar in Resynked. Bijvoorbeeld:

_Keuken 25 m² muren schilderen, plafond 12 m² sauzen. Klant Jan de Vries, Dorpsstraat 1, 1234 AB Utrecht, 06 12345678_

Noem je een klant die al in Resynked staat, dan gebruik ik die; anders maak ik een nieuwe klant aan. Stuur *stop* om een half afgemaakte offerte te wissen.`;

/** Eén binnengekomen bericht, zoals de webhook het doorgeeft. */
export interface IncomingMessage {
  id: string;
  /** Het nummer van de afzender, alleen cijfers met landcode */
  from: string;
  type: string;
  text: string | null;
}

export async function handleMessage(message: IncomingMessage) {
  const reply = (body: string) => sendText(message.from, body);

  const account = await findAccountByPhone(message.from);
  if (!account) {
    return reply(
      'Dit nummer is nog niet gekoppeld aan Resynked. Vul in Resynked bij Instellingen › Plug-ins › WhatsApp je mobiele nummer in, dan kun je meteen beginnen.'
    );
  }

  if (message.type !== 'text' || !message.text?.trim()) {
    return reply('Ik kan voorlopig alleen tekstberichten lezen. Typ wat je hebt opgemeten, dan maak ik er een offerte van.');
  }

  if (HELP_PATTERN.test(message.text)) return reply(HELP_TEXT);

  if (CANCEL_PATTERN.test(message.text)) {
    await setPending(account.id, null);
    return reply(account.pending_text ? 'Gewist. Je kunt opnieuw beginnen.' : 'Er stond niets open.');
  }

  await markReadAndTyping(message.id);
  return createQuoteFromMessage(account, message);
}

async function createQuoteFromMessage(account: WhatsAppAccountRow, message: IncomingMessage) {
  const reply = (body: string) => sendText(message.from, body);

  let ai;
  try {
    ai = await openAi(account.user_id);
  } catch (error) {
    if (error instanceof AiKeyError) {
      return reply('Om offertes te maken heb ik een AI-plug-in nodig. Zet er een aan bij Instellingen › Plug-ins › AI in Resynked.');
    }
    throw error;
  }

  // Ontbrak er bij het vorige bericht nog een klant, dan hoort dit bericht daarbij
  const pending =
    account.pending_text && account.pending_at && Date.now() - new Date(account.pending_at).getTime() < PENDING_MINUTES * 60_000
      ? account.pending_text
      : null;
  const transcript = pending ? `${pending}\n\n${message.text}` : message.text!;

  const [{ data: user }, tenant, pastLines] = await Promise.all([
    supabaseAdmin.from('users').select('name').eq('id', account.user_id).maybeSingle(),
    getTenant(account.tenant_id),
    pastQuoteLines(account.tenant_id),
  ]);

  let proposal: QuoteProposal;
  try {
    proposal = await ai.provider.proposeQuote(ai.apiKey, {
      source: 'whatsapp',
      transcript,
      companyName: tenant?.company_name || tenant?.name || '',
      userName: user?.name || '',
      knownCustomer: null,
      pastLines,
    });
  } catch (error: any) {
    console.error('WhatsApp omzetten naar offerte:', error);
    return reply(error.message || 'De AI kon je bericht niet verwerken. Probeer het opnieuw.');
  }

  if (!hasCustomer(proposal.customer)) {
    await setPending(account.id, transcript);
    return reply(
      'Voor welke klant is deze offerte? Stuur de naam, en liefst ook het adres, e-mailadres of telefoonnummer. Dan maak ik hem af.'
    );
  }

  const number = await takeDocumentNumber(account.tenant_id, 'quote');
  if (!number) {
    await setPending(account.id, transcript);
    return reply(
      'Ik kan nog geen offertenummer geven. Stel bij Instellingen › Account in Resynked het eerstvolgende offertenummer in en stuur me dan een berichtje, dan maak ik hem alsnog.'
    );
  }

  const { customer, isNew } = await findOrCreateCustomer(account.tenant_id, proposal.customer);
  const blocks = toBlocks(proposal);
  const today = vandaagHier();

  const quote = await createQuote(
    {
      tenant_id: account.tenant_id,
      customer_id: customer.id,
      quote_number: number,
      quote_date: today,
      valid_until: dagenErbij(today, 30),
      total: calculateDocumentTotal(blocks),
      status: 'draft',
      currency: 'EUR',
      intro_text: null,
      notes: null,
    },
    blocks
  );

  await setPending(account.id, null);
  return reply(summary(quote, customer, isNew, proposal, blocks));
}

// ------------------------------------------------------------
// De klant: een bestaande herkennen, of een nieuwe aanmaken
// ------------------------------------------------------------

type ProposedCustomer = QuoteProposal['customer'];

const CUSTOMER_FIELDS = [
  'first_name',
  'middle_name',
  'last_name',
  'company_name',
  'email',
  'phone',
  'street_address',
  'postal_code',
  'city',
] as const;

/** Genoeg om een klant aan te maken of terug te vinden: een naam, bedrijf, e-mail of telefoon. */
function hasCustomer(customer: ProposedCustomer): boolean {
  return [customer.first_name, customer.last_name, customer.company_name, customer.email, customer.phone].some(value =>
    value.trim()
  );
}

/** 06-12345678, 0612345678 en +31 6 12345678 zijn hetzelfde nummer: we vergelijken de laatste negen cijfers. */
const phoneKey = (value: string | null | undefined) => {
  const digits = (value || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : '';
};

const postcodeKey = (value: string | null | undefined) => (value || '').replace(/\s/g, '').toUpperCase();

const textKey = (value: string | null | undefined) => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Zoekt de klant op, van zeker naar minder zeker: hetzelfde e-mailadres,
 * hetzelfde telefoonnummer, of dezelfde naam. Bij een naam moet het om
 * precies één klant gaan, en als beide een postcode hebben moet die kloppen;
 * twee keer "Jan Jansen" in verschillende plaatsen zijn twee klanten.
 */
export function matchCustomer(customers: Customer[], proposed: ProposedCustomer): Customer | null {
  const email = textKey(proposed.email);
  if (email) {
    const found = customers.find(c => textKey(c.email) === email);
    if (found) return found;
  }

  const phone = phoneKey(proposed.phone);
  if (phone) {
    const found = customers.find(c => phoneKey(c.phone) === phone);
    if (found) return found;
  }

  const person = textKey(getCustomerPersonName(proposed));
  const company = textKey(proposed.company_name);
  const postcode = postcodeKey(proposed.postal_code);

  const byName = customers.filter(c =>
    person ? textKey(getCustomerPersonName(c) || c.name) === person : !!company && textKey(c.company_name) === company
  );
  const candidates = byName.filter(c => !postcode || !c.postal_code || postcodeKey(c.postal_code) === postcode);

  return candidates.length === 1 ? candidates[0] : null;
}

async function findOrCreateCustomer(tenantId: string, proposed: ProposedCustomer): Promise<{ customer: Customer; isNew: boolean }> {
  const { data, error } = await supabaseAdmin.from('customers').select('*').eq('tenant_id', tenantId);
  if (error) throw error;

  const values = Object.fromEntries(CUSTOMER_FIELDS.map(field => [field, proposed[field].trim()])) as Record<
    (typeof CUSTOMER_FIELDS)[number],
    string
  >;

  const existing = matchCustomer((data || []) as Customer[], proposed);
  if (existing) {
    // Wat de klant nog niet had, vullen we aan; wat er al stond blijft staan
    const additions = Object.fromEntries(
      CUSTOMER_FIELDS.filter(field => values[field] && !existing[field]).map(field => [field, values[field]])
    );
    const customer = Object.keys(additions).length ? await updateCustomer(existing.id, tenantId, additions) : existing;
    return { customer, isNew: false };
  }

  const customer = await createCustomer({
    tenant_id: tenantId,
    name: getCustomerPersonName(values) || values.company_name || values.email || values.phone,
    ...Object.fromEntries(CUSTOMER_FIELDS.map(field => [field, values[field] || null])),
    gender: null,
    address: null,
    date_of_birth: null,
    iban: null,
    kvk: null,
    btw_number: null,
    customer_number: null,
  } as Omit<Customer, 'id' | 'created_at' | 'updated_at'>);

  return { customer, isNew: true };
}

// ------------------------------------------------------------
// De offerte en het antwoord
// ------------------------------------------------------------

/** Dezelfde opbouw als "Omzetten naar offerte" in de Inbox: gegevens, inleiding, prijstabel, handtekening. */
function toBlocks(proposal: QuoteProposal): DocumentBlock[] {
  const title = proposal.quote.title.trim() || 'Offerte';
  const lines = proposal.quote.items.filter(item => item.description.trim());

  return [
    {
      title,
      elements: [
        emptyElement('gegevens'),
        ...(proposal.quote.intro.trim() ? [{ ...emptyElement('tekst'), body: plainTextToRichText(proposal.quote.intro) }] : []),
        {
          ...emptyElement('prijstabel'),
          items: (lines.length ? lines : [{ description: title, quantity: 1, unit: '', price: null, price_basis: '' }]).map(
            item => ({
              description: item.description.trim(),
              is_heading: false,
              quantity: Number(item.quantity) || 1,
              unit: item.unit.trim() || null,
              price: Number(item.price) || 0,
            })
          ),
        },
        emptyElement('handtekening'),
      ],
    },
  ];
}

const amount = (value: number) => (Number.isInteger(value) ? String(value) : value.toLocaleString('nl-NL'));

function summary(
  quote: { id: number; quote_number: string },
  customer: Customer,
  isNew: boolean,
  proposal: QuoteProposal,
  blocks: DocumentBlock[]
): string {
  const items = blocks[0].elements.find(element => element.kind === 'prijstabel')?.items || [];
  const withoutPrice = items.filter(item => !item.price).length;

  const lines = items.map(item => {
    const quantity = `${amount(Number(item.quantity))}${item.unit ? ` ${item.unit}` : '×'}`;
    const price = item.price ? `${formatCurrency(Number(item.price))} = ${formatCurrency(lineTotal(item))}` : 'prijs nog invullen';
    return `• ${item.description} — ${quantity}, ${price}`;
  });

  return [
    `Offerte *${quote.quote_number}* staat als concept klaar.`,
    '',
    `Klant: ${getCustomerDisplayName(customer)} (${isNew ? 'nieuwe klant aangemaakt' : 'bestaande klant'})`,
    `*${blocks[0].title}*`,
    ...lines,
    '',
    `Totaal: ${formatCurrency(calculateDocumentTotal(blocks))} incl. btw${
      withoutPrice ? ` (${withoutPrice === 1 ? 'één regel heeft' : `${withoutPrice} regels hebben`} nog geen prijs)` : ''
    }`,
    ...(proposal.missing.length ? ['', 'Nog aanvullen:', ...proposal.missing.map(item => `- ${item}`)] : []),
    '',
    `Bekijken en versturen: ${appUrl()}/quotes/${quote.id}`,
  ].join('\n');
}
