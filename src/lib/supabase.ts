import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client for browser usage (with RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Een mislukte fetch komt bij supabase-js binnen als kaal 'TypeError: fetch failed'.
// De werkelijke reden (ENOTFOUND bij een verkeerde URL, ECONNREFUSED bij een
// gepauzeerd project) zit in error.cause; die loggen we voordat hij verdwijnt.
const loggingFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (error) {
    const cause = (error as { cause?: { code?: string; message?: string } }).cause;
    console.error(
      `Supabase onbereikbaar op ${supabaseUrl} —`,
      cause?.code || cause?.message || error
    );
    throw error;
  }
};

// Admin client for server-side usage (bypasses RLS)
// Use this in API routes since we're handling authorization via NextAuth
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: { fetch: loggingFetch }
});

// Database types
export interface Tenant {
  id: string;
  name: string;
  company_name: string | null;
  street_address: string | null;
  postal_code: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  kvk: string | null;
  btw_number: string | null;
  iban: string | null;
  logo_url: string | null;
  quote_conditions: string | null;
  terms_and_conditions: string | null;
  quote_template_html: string | null;
  invoice_template_html: string | null;
  /** Onderwerp van de mail waarmee een offerte de deur uit gaat */
  email_subject: string | null;
  /** De tekst onder het logo in die mail */
  email_intro_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  tenant_id: string;
  name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  gender: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  street_address: string | null;
  postal_code: string | null;
  city: string | null;
  date_of_birth: string | null;
  iban: string | null;
  kvk: string | null;
  btw_number: string | null;
  customer_number: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Eén regel binnen een blok. Een regel met is_heading is een tussenkop
 * zonder bedrag, bijvoorbeeld "Dakwerkzaamheden".
 */
export interface LineItem {
  id?: number;
  description: string;
  is_heading: boolean;
  quantity: number;
  unit: string | null;
  price: number;
  total?: number;
  position?: number;
}

/**
 * Binnen een blok staan elementen. 'gegevens' toont de klant, het nummer en de
 * datums; 'kop' is een titel boven de inhoud; 'tekst' is een vrij verhaal;
 * 'prijstabel' bevat regels en heeft een eigen BTW-tarief, zodat 9% en 21%
 * naast elkaar kunnen staan met elk een eigen subtotaal.
 */
export type ElementKind = 'gegevens' | 'kop' | 'tekst' | 'prijstabel';

export interface DocumentElement {
  id?: number;
  kind: ElementKind;
  body: string | null;
  tax_percentage: number;
  discount_percentage: number;
  position?: number;
  items: LineItem[];
}

/** Een blok is één pagina van het document, met een eigen titel. */
export interface DocumentBlock {
  id?: number;
  title: string;
  position?: number;
  elements: DocumentElement[];
}

export interface Invoice {
  id: number;
  tenant_id: string;
  customer_id: number;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  currency?: string;
  total: number;
  status: string; // draft, sent, paid, cancelled
  intro_text?: string | null;
  notes?: string | null;
  quote_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: number;
  tenant_id: string;
  customer_id: number;
  quote_number: string;
  quote_date: string;
  valid_until: string;
  total: number;
  status: string; // draft, sent, approved, rejected, expired
  currency: string;
  intro_text?: string | null;
  notes?: string | null;
  converted_to_invoice_id?: number | null;
  /** Waarmee de klant zonder in te loggen bij zijn eigen offerte komt */
  public_token?: string;
  sent_at?: string | null;
  signed_at?: string | null;
  signed_name?: string | null;
  /** De handtekening van de klant als PNG data-URL */
  signature_image?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: number;
  tenant_id: string;
  customer_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}
