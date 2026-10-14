import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { AiKeyError, openAi, pastQuoteLines, threadToTranscript } from '@/lib/ai';
import { openMailbox, sendMailError } from '@/lib/mail';
import { getTenant } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';
import { getCustomerDisplayName } from '@/lib/utils';

// De AI leest het hele gesprek; dat kan even duren
export const config = {
  maxDuration: 120,
};

/** De klantvelden die de AI mag zien en aanvullen. */
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

/**
 * Een mailgesprek als voorstel voor een offerte: de klant, de regels met
 * prijzen uit eerdere offertes, wat er nog ontbreekt en een antwoord dat
 * daarom vraagt. Er wordt hier niets aangemaakt; dat doet de gebruiker
 * pas na controle.
 *
 * Body: { threadId }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const user = session.user as any;
  const threadId = String(req.body?.threadId || '');
  if (!threadId) return res.status(400).json({ error: 'Kies een mail' });

  let ai;
  try {
    ai = await openAi(user.id);
  } catch (error: any) {
    if (error instanceof AiKeyError) return res.status(409).json({ error: error.message, reconnect: true });
    throw error;
  }

  let thread;
  let ownAddress: string;
  try {
    const mailbox = await openMailbox(user.id);
    thread = await mailbox.provider.thread(mailbox.accessToken, threadId);
    ownAddress = mailbox.email.toLowerCase();
  } catch (error) {
    return sendMailError(res, error);
  }

  try {
    // Wie de offerte vraagt: de laatste afzender die niet jijzelf bent
    const requester = [...thread.messages].reverse().find(m => m.from.email.toLowerCase() !== ownAddress)?.from;

    const { data: known } = requester?.email
      ? await supabaseAdmin
          .from('customers')
          .select('*')
          .eq('tenant_id', user.tenantId)
          .ilike('email', requester.email)
          .limit(1)
          .maybeSingle()
      : { data: null };

    const [tenant, pastLines] = await Promise.all([getTenant(user.tenantId), pastQuoteLines(user.tenantId)]);

    const proposal = await ai.provider.proposeQuote(ai.apiKey, {
      transcript: threadToTranscript(thread),
      companyName: tenant?.company_name || tenant?.name || '',
      userName: user.name || '',
      knownCustomer: known
        ? Object.fromEntries(CUSTOMER_FIELDS.map(field => [field, known[field] || '']))
        : null,
      pastLines,
    });

    // Het adres van de afzender is zeker; dat hoeft de AI niet te raden
    if (requester?.email && !proposal.customer.email) proposal.customer.email = requester.email;

    return res.status(200).json({
      proposal,
      customer: known ? { id: known.id, name: getCustomerDisplayName(known) } : null,
      provider: ai.name,
    });
  } catch (error: any) {
    if (error instanceof AiKeyError) return res.status(409).json({ error: error.message, reconnect: true });
    console.error('Mail omzetten naar offerte:', error);
    return res.status(502).json({ error: error.message || 'De AI kon deze mail niet verwerken' });
  }
}
