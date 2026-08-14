-- ============================================================
-- Blokken worden pagina's met elementen erin
--
-- Voer dit uit in de Supabase SQL editor als je SCHEMA.sql al eerder hebt
-- gedraaid. Werk je met een lege database, draai dan gewoon het bijgewerkte
-- SCHEMA.sql; dit bestand is dan niet nodig.
--
-- Wat er verandert:
--   Een blok was óf tekst óf een prijstabel. Nu is een blok één pagina met
--   een titel, waarin je elementen zet: gegevens, tekst of een prijstabel —
--   zoveel als je wilt. Elk bestaand blok wordt een pagina met één element.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Offertes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quote_elements (
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

CREATE INDEX IF NOT EXISTS quote_elements_tenant_id_idx ON quote_elements(tenant_id);
CREATE INDEX IF NOT EXISTS quote_elements_block_id_idx ON quote_elements(block_id);

-- Elk bestaand blok wordt één element binnen dat blok
INSERT INTO quote_elements (tenant_id, block_id, kind, body, tax_percentage, discount_percentage, position)
SELECT b.tenant_id, b.id,
       CASE WHEN b.kind = 'tekst' THEN 'tekst' ELSE 'prijstabel' END,
       b.body, b.tax_percentage, b.discount_percentage, 0
FROM quote_blocks b
WHERE NOT EXISTS (SELECT 1 FROM quote_elements e WHERE e.block_id = b.id);

-- De regels verhuizen van het blok naar het element
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS element_id BIGINT REFERENCES quote_elements(id) ON DELETE CASCADE;

UPDATE quote_items i
SET element_id = e.id
FROM quote_elements e
WHERE e.block_id = i.block_id AND i.element_id IS NULL;

DELETE FROM quote_items WHERE element_id IS NULL;

ALTER TABLE quote_items ALTER COLUMN element_id SET NOT NULL;
ALTER TABLE quote_items DROP COLUMN IF EXISTS block_id;

CREATE INDEX IF NOT EXISTS quote_items_element_id_idx ON quote_items(element_id);

-- Een blok houdt alleen nog een titel over
ALTER TABLE quote_blocks DROP COLUMN IF EXISTS kind;
ALTER TABLE quote_blocks DROP COLUMN IF EXISTS body;
ALTER TABLE quote_blocks DROP COLUMN IF EXISTS tax_percentage;
ALTER TABLE quote_blocks DROP COLUMN IF EXISTS discount_percentage;

-- ------------------------------------------------------------
-- 2. Facturen, zelfde opzet
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_elements (
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

CREATE INDEX IF NOT EXISTS invoice_elements_tenant_id_idx ON invoice_elements(tenant_id);
CREATE INDEX IF NOT EXISTS invoice_elements_block_id_idx ON invoice_elements(block_id);

INSERT INTO invoice_elements (tenant_id, block_id, kind, body, tax_percentage, discount_percentage, position)
SELECT b.tenant_id, b.id,
       CASE WHEN b.kind = 'tekst' THEN 'tekst' ELSE 'prijstabel' END,
       b.body, b.tax_percentage, b.discount_percentage, 0
FROM invoice_blocks b
WHERE NOT EXISTS (SELECT 1 FROM invoice_elements e WHERE e.block_id = b.id);

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS element_id BIGINT REFERENCES invoice_elements(id) ON DELETE CASCADE;

UPDATE invoice_items i
SET element_id = e.id
FROM invoice_elements e
WHERE e.block_id = i.block_id AND i.element_id IS NULL;

DELETE FROM invoice_items WHERE element_id IS NULL;

ALTER TABLE invoice_items ALTER COLUMN element_id SET NOT NULL;
ALTER TABLE invoice_items DROP COLUMN IF EXISTS block_id;

CREATE INDEX IF NOT EXISTS invoice_items_element_id_idx ON invoice_items(element_id);

ALTER TABLE invoice_blocks DROP COLUMN IF EXISTS kind;
ALTER TABLE invoice_blocks DROP COLUMN IF EXISTS body;
ALTER TABLE invoice_blocks DROP COLUMN IF EXISTS tax_percentage;
ALTER TABLE invoice_blocks DROP COLUMN IF EXISTS discount_percentage;

-- ------------------------------------------------------------
-- 3. Rechten en RLS
-- ------------------------------------------------------------
ALTER TABLE quote_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_elements ENABLE ROW LEVEL SECURITY;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;
