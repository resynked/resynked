import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client for browser usage (with RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side usage (bypasses RLS)
// Use this in API routes since we're handling authorization via NextAuth
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Database types
export interface Tenant {
  id: string;
  name: string;
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
  debtor_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactPerson {
  id: number;
  tenant_id: string;
  customer_id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

/** Eén vrije regel op een offerte of factuur. */
export interface LineItem {
  id?: number;
  description: string;
  quantity: number;
  unit: string;
  price: number;
  total?: number;
  position?: number;
}

export interface Invoice {
  id: number;
  tenant_id: string;
  customer_id: number;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  currency?: string;
  tax_percentage?: number;
  discount_percentage?: number;
  total: number;
  status: string; // draft, sent, paid, cancelled
  notes?: string | null;
  quote_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem extends LineItem {
  invoice_id: number;
  tenant_id: string;
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
  tax_percentage: number;
  discount_percentage: number;
  notes?: string | null;
  converted_to_invoice_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteItem extends LineItem {
  quote_id: number;
  tenant_id: string;
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
