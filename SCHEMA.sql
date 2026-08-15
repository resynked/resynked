-- ============================================================
-- Resynked - volledig databaseschema
--
-- Voer dit bestand in zijn geheel uit in de Supabase SQL editor
-- (Dashboard -> SQL Editor -> New query -> plakken -> Run).
-- Het bouwt een lege database op; er is geen bestaande data nodig.
--
-- Opbouw:
--   tenants, users                accounts per aannemer
--   customers                     relaties
--   quotes, quote_blocks, ...     offertes in blokken met eigen BTW-tarief
--   invoices, invoice_blocks, ... facturen, zelfde opzet
--   notes                         notities per klant
-- ============================================================

-- ------------------------------------------------------------
-- Hulpfunctie: houdt updated_at bij
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- Tenants: één per aannemer
-- ------------------------------------------------------------
-- De bedrijfsgegevens en vaste teksten staan hier, zodat de offerte ze
-- per aannemer ophaalt in plaats van dat ze in de code staan.
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_name TEXT,
  street_address TEXT,
  postal_code TEXT,
  city TEXT,
  email TEXT,
  phone TEXT,
  kvk TEXT,
  btw_number TEXT,
  iban TEXT,
  logo_url TEXT,
  quote_conditions TEXT,        -- garanties, betalingsvoorwaarden, verzekering
  terms_and_conditions TEXT,    -- algemene voorwaarden
  email_from TEXT,              -- afzendadres; leeg = het systeemadres uit EMAIL_FROM
  quote_email_subject TEXT,     -- onderwerp van de offertemail
  quote_email_intro_text TEXT,  -- de tekst onder het logo in de offertemail
  invoice_email_subject TEXT,   -- onderwerp van de factuurmail
  invoice_email_intro_text TEXT,-- de tekst onder het logo in de factuurmail
  -- Het eerstvolgende nummer, bijvoorbeeld 20260050. De cijfers achteraan
  -- tellen bij elk document op; voorloopnullen blijven staan.
  quote_number_next TEXT,
  invoice_number_next TEXT,
  -- Eigen vormgeving per aannemer: HTML met data-slot plekken die het
  -- systeem vult met de klantgegevens, de regels en de totalen
  quote_template_html TEXT,
  invoice_template_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- Users: inloggen gaat via NextAuth, wachtwoord staat als bcrypt-hash
-- ------------------------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX users_tenant_id_idx ON users(tenant_id);

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- Customers: de klanten van de aannemer
-- ------------------------------------------------------------
CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  gender TEXT,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  street_address TEXT,
  postal_code TEXT,
  city TEXT,
  date_of_birth DATE,
  iban TEXT,
  kvk TEXT,
  btw_number TEXT,
  customer_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX customers_tenant_id_idx ON customers(tenant_id);

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- Offertes
-- ------------------------------------------------------------
CREATE TABLE quotes (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  quote_number TEXT NOT NULL,
  quote_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'expired')),
  currency TEXT NOT NULL DEFAULT 'EUR',
  intro_text TEXT,
  notes TEXT,
  converted_to_invoice_id BIGINT,
  -- Waarmee de klant zonder in te loggen bij zijn eigen offerte komt; deze
  -- sleutel staat alleen in de mail aan die klant
  public_token UUID NOT NULL DEFAULT gen_random_uuid(),
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signed_name TEXT,
  signature_image TEXT,         -- de handtekening als PNG data-URL
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX quotes_public_token_idx ON quotes(public_token);
CREATE INDEX quotes_tenant_id_idx ON quotes(tenant_id);
CREATE INDEX quotes_customer_id_idx ON quotes(customer_id);
CREATE INDEX quotes_created_at_idx ON quotes(created_at DESC);

CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Een offerte bestaat uit blokken; elk blok is een pagina met een eigen titel.
CREATE TABLE quote_blocks (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id BIGINT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX quote_blocks_tenant_id_idx ON quote_blocks(tenant_id);
CREATE INDEX quote_blocks_quote_id_idx ON quote_blocks(quote_id);

-- Binnen een blok staan elementen: de offertegegevens, een stuk tekst of een
-- prijstabel. Elke prijstabel heeft een eigen BTW-tarief, zodat 9% schilderwerk
-- en 21% overig werk naast elkaar kunnen staan met elk een eigen subtotaal.
CREATE TABLE quote_elements (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  block_id BIGINT NOT NULL REFERENCES quote_blocks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'tekst'
    CHECK (kind IN ('gegevens', 'kop', 'tekst', 'prijstabel')),
  body TEXT,
  tax_percentage NUMERIC(5,2) NOT NULL DEFAULT 21,
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX quote_elements_tenant_id_idx ON quote_elements(tenant_id);
CREATE INDEX quote_elements_block_id_idx ON quote_elements(block_id);

-- Regels van een prijstabel. Een regel met is_heading is een tussenkop.
CREATE TABLE quote_items (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  element_id BIGINT NOT NULL REFERENCES quote_elements(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_heading BOOLEAN NOT NULL DEFAULT false,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX quote_items_tenant_id_idx ON quote_items(tenant_id);
CREATE INDEX quote_items_element_id_idx ON quote_items(element_id);

-- ------------------------------------------------------------
-- Facturen
-- ------------------------------------------------------------
CREATE TABLE invoices (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  currency TEXT NOT NULL DEFAULT 'EUR',
  intro_text TEXT,
  notes TEXT,
  quote_id BIGINT REFERENCES quotes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX invoices_tenant_id_idx ON invoices(tenant_id);
CREATE INDEX invoices_customer_id_idx ON invoices(customer_id);
CREATE INDEX invoices_created_at_idx ON invoices(created_at DESC);

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Factuurblokken: zelfde opzet als bij de offerte, zodat een offerte met
-- twee BTW-tarieven die splitsing meeneemt naar de factuur
CREATE TABLE invoice_blocks (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX invoice_blocks_tenant_id_idx ON invoice_blocks(tenant_id);
CREATE INDEX invoice_blocks_invoice_id_idx ON invoice_blocks(invoice_id);

CREATE TABLE invoice_elements (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  block_id BIGINT NOT NULL REFERENCES invoice_blocks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'tekst'
    CHECK (kind IN ('gegevens', 'kop', 'tekst', 'prijstabel')),
  body TEXT,
  tax_percentage NUMERIC(5,2) NOT NULL DEFAULT 21,
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX invoice_elements_tenant_id_idx ON invoice_elements(tenant_id);
CREATE INDEX invoice_elements_block_id_idx ON invoice_elements(block_id);

CREATE TABLE invoice_items (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  element_id BIGINT NOT NULL REFERENCES invoice_elements(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_heading BOOLEAN NOT NULL DEFAULT false,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX invoice_items_tenant_id_idx ON invoice_items(tenant_id);
CREATE INDEX invoice_items_element_id_idx ON invoice_items(element_id);

-- Een omgezette offerte wijst naar zijn factuur; deze koppeling kan pas
-- gelegd worden nu beide tabellen bestaan
ALTER TABLE quotes
  ADD CONSTRAINT quotes_converted_to_invoice_id_fkey
  FOREIGN KEY (converted_to_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- Notities per klant
-- ------------------------------------------------------------
CREATE TABLE notes (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notes_tenant_id_idx ON notes(tenant_id);
CREATE INDEX notes_customer_id_idx ON notes(customer_id);
CREATE INDEX notes_created_at_idx ON notes(created_at DESC);

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- Row Level Security
--
-- De app praat met de database via de service role key en filtert zelf
-- op de tenant uit de NextAuth-sessie. RLS staat hier aan zodat de
-- publieke anon key niets kan lezen of schrijven: zonder policy komt
-- er via die sleutel geen enkele rij door.
-- ------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Rechten voor de service role
--
-- Zelf aangemaakte tabellen krijgen in een nieuw Supabase-project geen
-- rechten meer toebedeeld. Zonder deze grants antwoordt de API met
-- 42501 "permission denied", ook op een sleutel die RLS mag omzeilen.
-- De sequences horen erbij: zonder USAGE daarop mislukt elke insert
-- in een tabel met een BIGSERIAL-id.
--
-- anon en authenticated krijgen bewust niets: de app praat uitsluitend
-- via de service role, en zonder rechten komt de publieke sleutel
-- nergens bij.
-- ------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Ook voor tabellen die je hierna nog toevoegt
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
