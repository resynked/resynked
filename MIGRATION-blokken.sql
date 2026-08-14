-- ============================================================
-- Offertes en facturen in blokken
--
-- Voer dit uit in de Supabase SQL editor als je SCHEMA.sql al eerder
-- hebt gedraaid. Werk je met een lege database, draai dan gewoon het
-- bijgewerkte SCHEMA.sql; dit bestand is dan niet nodig.
--
-- Wat er verandert:
--   1. Bedrijfsgegevens en vaste teksten bij de aannemer (tenants)
--   2. Offertes en facturen krijgen blokken met een eigen BTW-tarief
--   3. Bestaande regels verhuizen naar een eerste blok, met het tarief
--      dat op de offerte of factuur stond — er gaat niets verloren
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Bedrijfsgegevens per aannemer
-- ------------------------------------------------------------
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS street_address TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kvk TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS btw_number TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS quote_conditions TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;

UPDATE tenants SET company_name = name WHERE company_name IS NULL;

-- ------------------------------------------------------------
-- 2. Offerteblokken
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quote_blocks (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id BIGINT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'prijsopgave'
    CHECK (kind IN ('tekst', 'prijsopgave')),
  body TEXT,
  tax_percentage NUMERIC(5,2) NOT NULL DEFAULT 21,
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quote_blocks_tenant_id_idx ON quote_blocks(tenant_id);
CREATE INDEX IF NOT EXISTS quote_blocks_quote_id_idx ON quote_blocks(quote_id);

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS intro_text TEXT;

-- Elke bestaande offerte krijgt één blok met het tarief dat erop stond
INSERT INTO quote_blocks (tenant_id, quote_id, title, kind, tax_percentage, discount_percentage, position)
SELECT q.tenant_id, q.id, 'Werkzaamheden', 'prijsopgave',
       COALESCE(q.tax_percentage, 21), COALESCE(q.discount_percentage, 0), 0
FROM quotes q
WHERE NOT EXISTS (SELECT 1 FROM quote_blocks b WHERE b.quote_id = q.id);

ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS block_id BIGINT REFERENCES quote_blocks(id) ON DELETE CASCADE;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS is_heading BOOLEAN NOT NULL DEFAULT false;

UPDATE quote_items i
SET block_id = b.id
FROM quote_blocks b
WHERE b.quote_id = i.quote_id AND i.block_id IS NULL;

-- Regels zonder offerte zijn wees en kunnen weg
DELETE FROM quote_items WHERE block_id IS NULL;

ALTER TABLE quote_items ALTER COLUMN block_id SET NOT NULL;
ALTER TABLE quote_items ALTER COLUMN unit DROP NOT NULL;
ALTER TABLE quote_items ALTER COLUMN unit DROP DEFAULT;
ALTER TABLE quote_items DROP COLUMN IF EXISTS quote_id;

CREATE INDEX IF NOT EXISTS quote_items_block_id_idx ON quote_items(block_id);

ALTER TABLE quotes DROP COLUMN IF EXISTS tax_percentage;
ALTER TABLE quotes DROP COLUMN IF EXISTS discount_percentage;

-- ------------------------------------------------------------
-- 3. Factuurblokken
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_blocks (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'prijsopgave'
    CHECK (kind IN ('tekst', 'prijsopgave')),
  body TEXT,
  tax_percentage NUMERIC(5,2) NOT NULL DEFAULT 21,
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoice_blocks_tenant_id_idx ON invoice_blocks(tenant_id);
CREATE INDEX IF NOT EXISTS invoice_blocks_invoice_id_idx ON invoice_blocks(invoice_id);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS intro_text TEXT;

INSERT INTO invoice_blocks (tenant_id, invoice_id, title, kind, tax_percentage, discount_percentage, position)
SELECT i.tenant_id, i.id, 'Werkzaamheden', 'prijsopgave',
       COALESCE(i.tax_percentage, 21), COALESCE(i.discount_percentage, 0), 0
FROM invoices i
WHERE NOT EXISTS (SELECT 1 FROM invoice_blocks b WHERE b.invoice_id = i.id);

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS block_id BIGINT REFERENCES invoice_blocks(id) ON DELETE CASCADE;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS is_heading BOOLEAN NOT NULL DEFAULT false;

UPDATE invoice_items i
SET block_id = b.id
FROM invoice_blocks b
WHERE b.invoice_id = i.invoice_id AND i.block_id IS NULL;

DELETE FROM invoice_items WHERE block_id IS NULL;

ALTER TABLE invoice_items ALTER COLUMN block_id SET NOT NULL;
ALTER TABLE invoice_items ALTER COLUMN unit DROP NOT NULL;
ALTER TABLE invoice_items ALTER COLUMN unit DROP DEFAULT;
ALTER TABLE invoice_items DROP COLUMN IF EXISTS invoice_id;

CREATE INDEX IF NOT EXISTS invoice_items_block_id_idx ON invoice_items(block_id);

ALTER TABLE invoices DROP COLUMN IF EXISTS tax_percentage;
ALTER TABLE invoices DROP COLUMN IF EXISTS discount_percentage;

-- ------------------------------------------------------------
-- 4. Rechten en RLS voor de nieuwe tabellen
-- ------------------------------------------------------------
ALTER TABLE quote_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_blocks ENABLE ROW LEVEL SECURITY;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;
