/**
 * Leest scripts/import-data.json in en zet de klanten en offertes in de
 * database van de aannemer die in dat bestand genoemd staat.
 *
 *   node scripts/import.mjs            kijkt alleen wat er zou gebeuren
 *   node scripts/import.mjs --schrijf  voert het ook echt uit
 *
 * De sleutels komen uit .env.local en blijven op deze machine.
 *
 * Twee dingen maken het veilig om nog eens te draaien:
 *   - een klant op een adres dat al bestaat wordt hergebruikt
 *   - een offertenummer dat al bestaat wordt overgeslagen
 *
 * De regels hieronder doen hetzelfde als saveBlocks in src/lib/db.ts. Die kan
 * hier niet ingeladen worden — dat is TypeScript met eigen padnamen, en dit
 * script draait zonder bouwstap.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const schrijven = process.argv.includes('--schrijf');

// ------------------------------------------------------------
// Omgeving
// ------------------------------------------------------------

function readEnv() {
  const env = {};

  for (const file of ['.env.local', '.env']) {
    let raw;
    try {
      raw = readFileSync(join(root, file), 'utf8');
    } catch {
      continue;
    }

    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      // Aanhalingstekens eromheen horen niet bij de waarde
      env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }

  return env;
}

const env = { ...readEnv(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Zet NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// ------------------------------------------------------------
// Rekenen, gelijk aan src/lib/utils.ts
// ------------------------------------------------------------

const round = (value) => Math.round(value * 100) / 100;

const lineTotal = (item) =>
  item.is_heading ? 0 : round((Number(item.quantity ?? 1) || 0) * (Number(item.price) || 0));

function elementTotal(element) {
  if (element.kind !== 'prijstabel') return 0;

  const subtotal = (element.items || []).reduce((sum, item) => sum + lineTotal(item), 0);
  const discount = (subtotal * (Number(element.discount_percentage) || 0)) / 100;
  const taxable = subtotal - discount;

  return taxable + (taxable * (Number(element.tax_percentage) || 0)) / 100;
}

// Per prijstabel afronden, gelijk aan calculateDocumentTotal in src/lib/utils.ts
const documentTotal = (blocks) =>
  round(blocks.reduce((sum, block) => sum + block.elements.reduce((s, e) => s + round(elementTotal(e)), 0), 0));

/** Het adres waarop twee klanten als dezelfde gelden. */
const addressKey = (customer) =>
  [customer.street_address, customer.postal_code, customer.city]
    .map((part) => (part || '').toLowerCase().replace(/\s+/g, ''))
    .join('|');

const now = () => new Date().toISOString();

// ------------------------------------------------------------
// Wegschrijven
// ------------------------------------------------------------

async function saveBlocks(quoteId, tenantId, blocks) {
  for (const [blockIndex, block] of blocks.entries()) {
    const { data: savedBlock, error: blockError } = await db
      .from('quote_blocks')
      .insert({ quote_id: quoteId, tenant_id: tenantId, title: block.title || '', position: blockIndex })
      .select('id')
      .single();

    if (blockError) throw blockError;

    for (const [elementIndex, element] of (block.elements || []).entries()) {
      const { data: savedElement, error: elementError } = await db
        .from('quote_elements')
        .insert({
          block_id: savedBlock.id,
          tenant_id: tenantId,
          kind: element.kind,
          body: element.kind === 'tekst' || element.kind === 'kop' ? element.body || null : null,
          tax_percentage: Number(element.tax_percentage) || 0,
          discount_percentage: Number(element.discount_percentage) || 0,
          position: elementIndex,
        })
        .select('id')
        .single();

      if (elementError) throw elementError;

      const items = element.kind === 'prijstabel' ? element.items || [] : [];
      if (items.length === 0) continue;

      const { error: itemsError } = await db.from('quote_items').insert(
        items.map((item, itemIndex) => ({
          element_id: savedElement.id,
          tenant_id: tenantId,
          description: (item.description || '').trim(),
          is_heading: !!item.is_heading,
          quantity: item.is_heading ? 0 : Number(item.quantity ?? 1) || 0,
          unit: item.is_heading ? null : item.unit || null,
          price: item.is_heading ? 0 : Number(item.price) || 0,
          total: lineTotal(item),
          position: itemIndex,
        }))
      );

      if (itemsError) throw itemsError;
    }
  }
}

// ------------------------------------------------------------
// Hoofdprogramma
// ------------------------------------------------------------

const data = JSON.parse(readFileSync(join(here, 'import-data.json'), 'utf8'));

console.log(schrijven ? 'Bezig met importeren...\n' : 'Proefdraai — er wordt niets weggeschreven.\n');

// De aannemer opzoeken via het account waarmee hij inlogt
const { data: user, error: userError } = await db
  .from('users')
  .select('tenant_id')
  .eq('email', data.tenantEmail)
  .maybeSingle();

if (userError) throw userError;

if (!user) {
  console.error(`Geen account gevonden op ${data.tenantEmail}`);
  process.exit(1);
}

const tenantId = user.tenant_id;
console.log(`Account ${data.tenantEmail} → tenant ${tenantId}\n`);

// Bestaande klanten ophalen om op adres te kunnen ontdubbelen
const { data: existingCustomers, error: customersError } = await db
  .from('customers')
  .select('id, name, customer_number, street_address, postal_code, city')
  .eq('tenant_id', tenantId);

if (customersError) throw customersError;

const byAddress = new Map(existingCustomers.map((c) => [addressKey(c), c]));
const idByKey = new Map();

console.log('Klanten');

for (const customer of data.customers) {
  const bestaand = byAddress.get(addressKey(customer));

  if (bestaand) {
    idByKey.set(customer.key, bestaand.id);

    // Een klant die er al stond heeft nog geen klantnummer; dat vullen we alsnog
    if (customer.customer_number && !bestaand.customer_number) {
      if (schrijven) {
        const { error } = await db
          .from('customers')
          .update({ customer_number: customer.customer_number, updated_at: now() })
          .eq('id', bestaand.id);
        if (error) throw error;
      }
      console.log(`  ~ ${bestaand.name} — bestond al, klantnummer ${customer.customer_number} toegevoegd`);
    } else {
      console.log(`  = ${customer.name || customer.street_address} — bestaat al, hergebruikt`);
    }
    continue;
  }

  if (!schrijven) {
    idByKey.set(customer.key, null);
    console.log(`  + ${customer.customer_number} ${customer.name || '(naam volgt)'} — ${customer.street_address}, ${customer.postal_code} ${customer.city}`);
    continue;
  }

  const { data: created, error } = await db
    .from('customers')
    .insert({
      tenant_id: tenantId,
      name: customer.name || '',
      first_name: customer.first_name || null,
      middle_name: customer.middle_name || null,
      last_name: customer.last_name || null,
      company_name: customer.company_name || null,
      email: customer.email || null,
      phone: customer.phone || null,
      street_address: customer.street_address || null,
      postal_code: customer.postal_code || null,
      city: customer.city || null,
      address: [customer.street_address, customer.postal_code, customer.city].filter(Boolean).join(', '),
      customer_number: customer.customer_number || null,
      updated_at: now(),
    })
    .select('id')
    .single();

  if (error) throw error;

  idByKey.set(customer.key, created.id);
  byAddress.set(addressKey(customer), { ...customer, id: created.id });
  console.log(`  + ${customer.customer_number} ${customer.name || '(naam volgt)'} — ${customer.street_address}`);
}

console.log('\nOffertes');

let hoogsteNummer = null;

for (const quote of data.quotes) {
  const { data: bestaand, error } = await db
    .from('quotes')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('quote_number', quote.quote_number)
    .maybeSingle();

  if (error) throw error;

  const totaal = documentTotal(quote.blocks);
  const regels = quote.blocks.reduce(
    (sum, b) => sum + b.elements.reduce((s, e) => s + (e.items?.length || 0), 0),
    0
  );

  if (bestaand) {
    console.log(`  = ${quote.quote_number} — bestaat al, overgeslagen`);
    continue;
  }

  console.log(
    `  ${schrijven ? '+' : ' '} ${quote.quote_number} — ${quote.blocks.length} blokken, ${regels} regels, ` +
      `totaal € ${totaal.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`
  );

  if (!hoogsteNummer || quote.quote_number > hoogsteNummer) hoogsteNummer = quote.quote_number;

  if (!schrijven) continue;

  const customerId = idByKey.get(quote.customer);
  if (!customerId) throw new Error(`Onbekende klant "${quote.customer}" bij offerte ${quote.quote_number}`);

  const { data: created, error: quoteError } = await db
    .from('quotes')
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      quote_number: quote.quote_number,
      quote_date: quote.quote_date,
      valid_until: quote.valid_until,
      total: totaal,
      status: quote.status || 'sent',
      currency: quote.currency || 'EUR',
      updated_at: now(),
    })
    .select('id')
    .single();

  if (quoteError) throw quoteError;

  await saveBlocks(created.id, tenantId, quote.blocks);
}

// De teller voor nieuwe offertes voorbij de geïmporteerde nummers zetten,
// anders botst de eerstvolgende nieuwe offerte met een die net ingelezen is
if (schrijven && hoogsteNummer) {
  const { data: tenant } = await db
    .from('tenants')
    .select('quote_number_next')
    .eq('id', tenantId)
    .single();

  const huidig = (tenant?.quote_number_next || '').trim();

  if (!huidig || huidig <= hoogsteNummer) {
    const volgend = String(BigInt(hoogsteNummer) + 1n);
    await db.from('tenants').update({ quote_number_next: volgend, updated_at: now() }).eq('id', tenantId);
    console.log(`\nVolgend offertenummer gezet op ${volgend}`);
  }
}

console.log(
  schrijven
    ? '\nKlaar.'
    : '\nNiets weggeschreven. Draai met --schrijf als bovenstaande klopt.'
);
