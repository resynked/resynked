import { supabaseAdmin } from './supabase';
import { decrypt, encrypt } from './crypto';

/**
 * Mollie: betalen met iDEAL (en andere methoden) vanuit de factuur. Optioneel,
 * als plug-in; zonder Mollie betaalt de klant gewoon met de QR-code.
 *
 * Eén account per bedrijf, met de API-sleutel uit het eigen Mollie-dashboard
 * van de aannemer. Het geld gaat daardoor rechtstreeks naar zijn rekening;
 * Synbased komt er niet aan. De sleutel staat versleuteld in de database en
 * verlaat de server niet.
 *
 * We praten rechtstreeks met de API van Mollie (api.mollie.com/v2).
 */

const API = 'https://api.mollie.com/v2';

/** Een sleutel die niet klopt; de melding is voor de gebruiker */
export class MollieKeyError extends Error {}

async function mollieFetch(apiKey: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) throw new MollieKeyError('Mollie herkent deze sleutel niet');
  if (!response.ok) throw new Error(data.detail || `Mollie antwoordde met ${response.status}`);
  return data;
}

/** Een live- of testsleutel uit het Mollie-dashboard */
export function isMollieKey(key: string): boolean {
  return /^(live|test)_[A-Za-z0-9]{20,}$/.test(key.trim());
}

/** Of de sleutel werkt: een kleine aanvraag die met elke geldige sleutel lukt */
export async function verifyMollieKey(apiKey: string): Promise<void> {
  if (!isMollieKey(apiKey)) {
    throw new MollieKeyError('Dit lijkt geen Mollie-sleutel. Hij begint met live_ of test_');
  }
  await mollieFetch(apiKey.trim(), '/methods');
}

/** Of dit bedrijf Mollie heeft gekoppeld, en of het een testsleutel is */
export async function getMollieAccount(tenantId: string): Promise<{ test: boolean } | null> {
  const { data } = await supabaseAdmin.from('mollie_accounts').select('api_key').eq('tenant_id', tenantId).maybeSingle();
  if (!data) return null;
  return { test: decrypt(data.api_key).startsWith('test_') };
}

export async function saveMollieAccount(tenantId: string, apiKey: string) {
  const { error } = await supabaseAdmin
    .from('mollie_accounts')
    .upsert({ tenant_id: tenantId, api_key: encrypt(apiKey.trim()) }, { onConflict: 'tenant_id' });
  if (error) throw error;
}

export async function deleteMollieAccount(tenantId: string) {
  const { error } = await supabaseAdmin.from('mollie_accounts').delete().eq('tenant_id', tenantId);
  if (error) throw error;
}

async function apiKeyOf(tenantId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('mollie_accounts').select('api_key').eq('tenant_id', tenantId).maybeSingle();
  return data ? decrypt(data.api_key) : null;
}

/**
 * Een nieuwe betaling. De klant gaat naar checkoutUrl, betaalt bij Mollie, en
 * komt daarna terug op redirectUrl. Mollie meldt de uitkomst los aan webhookUrl.
 */
export async function createMolliePayment(
  tenantId: string,
  { amount, description, redirectUrl, webhookUrl, invoiceId }: {
    amount: number;
    description: string;
    redirectUrl: string;
    webhookUrl: string;
    invoiceId: number;
  }
): Promise<{ id: string; checkoutUrl: string }> {
  const apiKey = await apiKeyOf(tenantId);
  if (!apiKey) throw new Error('Mollie is niet gekoppeld');

  const payment = await mollieFetch(apiKey, '/payments', {
    method: 'POST',
    body: JSON.stringify({
      amount: { currency: 'EUR', value: amount.toFixed(2) },
      description: description.slice(0, 255),
      redirectUrl,
      webhookUrl,
      metadata: { invoiceId },
    }),
  });

  return { id: payment.id, checkoutUrl: payment._links?.checkout?.href };
}

/** De stand van een betaling, rechtstreeks bij Mollie opgevraagd */
export async function getMolliePayment(tenantId: string, paymentId: string) {
  const apiKey = await apiKeyOf(tenantId);
  if (!apiKey) throw new Error('Mollie is niet gekoppeld');
  return mollieFetch(apiKey, `/payments/${encodeURIComponent(paymentId)}`) as Promise<{
    id: string;
    status: string;
    paidAt?: string;
    metadata?: { invoiceId?: number };
  }>;
}
