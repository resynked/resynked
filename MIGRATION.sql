-- ============================================================
-- Resynked - migraties
--
-- Dit is het enige migratiebestand. Draai het in zijn geheel in de Supabase
-- SQL editor (Dashboard -> SQL Editor -> New query -> plakken -> Run) als je
-- een bestaande database bijwerkt. Alles hieronder is zo geschreven dat
-- opnieuw draaien geen kwaad kan: wat al gebeurd is, wordt overgeslagen.
--
-- Lege database? Draai [SCHEMA.sql](SCHEMA.sql); die bouwt alles in één keer
-- goed op en dit bestand is dan niet nodig.
--
-- Nieuwe aanpassing aan het schema? Zet hem onderaan in dit bestand, als een
-- nieuw genummerd onderdeel. Maak er geen apart bestand voor, en pas ook
-- SCHEMA.sql aan zodat een verse database dezelfde vorm krijgt.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Blokken worden pagina's met elementen erin
--
-- Een blok was óf tekst óf een prijstabel. Nu is een blok één pagina met een
-- titel, waarin je elementen zet: gegevens, een kop, tekst of een prijstabel —
-- zoveel als je wilt. Elk bestaand blok wordt een pagina met één element.
-- ------------------------------------------------------------

-- 1a. De elementen-tabellen
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

-- 1b. Elk bestaand blok wordt één element binnen dat blok
--
-- Dit hoeft alleen zolang een blok nog zijn eigen kind en body heeft. Zijn die
-- kolommen al weg, dan is dit onderdeel eerder gedraaid en slaan we het over.
-- De opdracht staat in EXECUTE, zodat Postgres hem niet probeert te begrijpen
-- op een database waar die kolommen niet meer bestaan.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quote_blocks' AND column_name = 'kind'
  ) THEN
    EXECUTE $sql$
      INSERT INTO quote_elements (tenant_id, block_id, kind, body, tax_percentage, discount_percentage, position)
      SELECT b.tenant_id, b.id,
             CASE WHEN b.kind = 'tekst' THEN 'tekst' ELSE 'prijstabel' END,
             b.body, b.tax_percentage, b.discount_percentage, 0
      FROM quote_blocks b
      WHERE NOT EXISTS (SELECT 1 FROM quote_elements e WHERE e.block_id = b.id)
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoice_blocks' AND column_name = 'kind'
  ) THEN
    EXECUTE $sql$
      INSERT INTO invoice_elements (tenant_id, block_id, kind, body, tax_percentage, discount_percentage, position)
      SELECT b.tenant_id, b.id,
             CASE WHEN b.kind = 'tekst' THEN 'tekst' ELSE 'prijstabel' END,
             b.body, b.tax_percentage, b.discount_percentage, 0
      FROM invoice_blocks b
      WHERE NOT EXISTS (SELECT 1 FROM invoice_elements e WHERE e.block_id = b.id)
    $sql$;
  END IF;
END $$;

-- 1c. De regels verhuizen van het blok naar het element
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS element_id BIGINT REFERENCES quote_elements(id) ON DELETE CASCADE;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS element_id BIGINT REFERENCES invoice_elements(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quote_items' AND column_name = 'block_id'
  ) THEN
    EXECUTE $sql$
      UPDATE quote_items i
      SET element_id = e.id
      FROM quote_elements e
      WHERE e.block_id = i.block_id AND i.element_id IS NULL
    $sql$;
    EXECUTE 'ALTER TABLE quote_items DROP COLUMN block_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoice_items' AND column_name = 'block_id'
  ) THEN
    EXECUTE $sql$
      UPDATE invoice_items i
      SET element_id = e.id
      FROM invoice_elements e
      WHERE e.block_id = i.block_id AND i.element_id IS NULL
    $sql$;
    EXECUTE 'ALTER TABLE invoice_items DROP COLUMN block_id';
  END IF;
END $$;

-- Een regel zonder element hoort nergens meer bij en kan weg
DELETE FROM quote_items WHERE element_id IS NULL;
DELETE FROM invoice_items WHERE element_id IS NULL;

ALTER TABLE quote_items ALTER COLUMN element_id SET NOT NULL;
ALTER TABLE invoice_items ALTER COLUMN element_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS quote_items_element_id_idx ON quote_items(element_id);
CREATE INDEX IF NOT EXISTS invoice_items_element_id_idx ON invoice_items(element_id);

-- 1d. Een blok houdt alleen nog een titel over
ALTER TABLE quote_blocks DROP COLUMN IF EXISTS kind;
ALTER TABLE quote_blocks DROP COLUMN IF EXISTS body;
ALTER TABLE quote_blocks DROP COLUMN IF EXISTS tax_percentage;
ALTER TABLE quote_blocks DROP COLUMN IF EXISTS discount_percentage;

ALTER TABLE invoice_blocks DROP COLUMN IF EXISTS kind;
ALTER TABLE invoice_blocks DROP COLUMN IF EXISTS body;
ALTER TABLE invoice_blocks DROP COLUMN IF EXISTS tax_percentage;
ALTER TABLE invoice_blocks DROP COLUMN IF EXISTS discount_percentage;

-- ------------------------------------------------------------
-- 2. De toegestane elementtypes
--
-- Dit repareert de melding:
--   new row for relation "quote_elements" violates check constraint
--   "quote_elements_kind_check"
--
-- De tabellen hierboven worden gemaakt met CREATE TABLE IF NOT EXISTS, en dat
-- slaat een bestaande tabel over — inclusief de CHECK die eraan hangt. Een
-- database van vóór het element 'kop' houdt dus zijn oude rijtje waarden en
-- weigert een kop-element. Daarom wordt de CHECK hier opnieuw gezet.
--
-- Hier staat welke elementen een blok mag bevatten. Komt er een type bij, dan
-- hoef je alleen deze lijst aan te vullen; de CHECK wordt hieronder opnieuw
-- gezet, dus een bestaande database loopt vanzelf mee.
--
-- Elke bestaande CHECK op kind gaat er eerst uit, ongeacht zijn naam. Op naam
-- werken is hier niet genoeg: laat je er per ongeluk één staan, dan blijft die
-- oude regel meebeslissen en wordt een kop nog steeds geweigerd — zonder dat
-- dit bestand een fout geeft.
-- ------------------------------------------------------------
DO $$
DECLARE
  doel TEXT;
  bestaande RECORD;
BEGIN
  FOREACH doel IN ARRAY ARRAY['quote_elements', 'invoice_elements'] LOOP
    FOR bestaande IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = doel::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%kind%'
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', doel, bestaande.conname);
    END LOOP;

    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (kind IN (%L, %L, %L, %L, %L))',
      doel, doel || '_kind_check', 'gegevens', 'kop', 'tekst', 'prijstabel', 'handtekening'
    );
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 3. Offertes versturen en laten ondertekenen
--
-- De aannemer stelt bij Instellingen > E-mail zijn vaste begeleidende tekst in.
-- Elke offerte krijgt een eigen sleutel: daarmee komt de klant via de knop in
-- de mail op een pagina waar hij de offerte ziet en kan tekenen. De sleutel is
-- een gok-bestendige UUID en is het enige wat die pagina beveiligt, dus hij
-- staat nergens anders dan in de mail aan die ene klant.
-- ------------------------------------------------------------
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email_subject TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email_intro_text TEXT;
-- Het afzendadres van deze aannemer. Blijft dit leeg, dan gaat de mail uit
-- vanaf het systeemadres in EMAIL_FROM.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email_from TEXT;

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS public_token UUID;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signed_name TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signature_image TEXT;

-- Bestaande offertes krijgen alsnog een sleutel, daarna mag de kolom niet leeg
UPDATE quotes SET public_token = gen_random_uuid() WHERE public_token IS NULL;
ALTER TABLE quotes ALTER COLUMN public_token SET DEFAULT gen_random_uuid();
ALTER TABLE quotes ALTER COLUMN public_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS quotes_public_token_idx ON quotes(public_token);

-- ------------------------------------------------------------
-- 4. Eigen nummering en een aparte tekst voor de factuurmail
--
-- De offerte- en factuurmail hebben elk hun eigen onderwerp en tekst, dus de
-- velden die er waren krijgen er 'quote_' voor en er komt een factuurversie
-- naast. Daarnaast bepaalt de aannemer voortaan zelf zijn nummering: hij vult
-- het eerstvolgende nummer in, bijvoorbeeld 20260050, en het systeem telt de
-- cijfers achteraan op — 20260051, 20260052 — met de voorloopnullen intact.
-- ------------------------------------------------------------
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS quote_email_subject TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS quote_email_intro_text TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS invoice_email_subject TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS invoice_email_intro_text TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS quote_number_next TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS invoice_number_next TEXT;

-- De oude velden heetten email_subject en email_intro_text en gingen over de
-- offerte. Hun inhoud verhuist mee; daarna kunnen ze weg. Staan ze er al niet
-- meer, dan is dit onderdeel eerder gedraaid en gebeurt er niets.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'email_subject'
  ) THEN
    EXECUTE 'UPDATE tenants SET quote_email_subject = email_subject WHERE quote_email_subject IS NULL';
    EXECUTE 'ALTER TABLE tenants DROP COLUMN email_subject';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'email_intro_text'
  ) THEN
    EXECUTE 'UPDATE tenants SET quote_email_intro_text = email_intro_text WHERE quote_email_intro_text IS NULL';
    EXECUTE 'ALTER TABLE tenants DROP COLUMN email_intro_text';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. Rechten en RLS voor de nieuwe tabellen
--
-- Zonder deze grants antwoordt de API met 42501 "permission denied", ook op
-- een sleutel die RLS mag omzeilen. anon en authenticated krijgen bewust
-- niets: de app praat uitsluitend via de service role.
-- ------------------------------------------------------------
ALTER TABLE quote_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_elements ENABLE ROW LEVEL SECURITY;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;

-- ------------------------------------------------------------
-- Controle achteraf
--
-- Eén opdracht, want de SQL-editor toont alleen de uitkomst van de laatste.
-- Er horen zes regels uit te komen die allemaal met "ja" beginnen. Staat er
-- ergens NEE, dan is dat onderdeel niet gelukt.
-- ------------------------------------------------------------
SELECT 'Elementtypes offerte' AS controle,
       COALESCE(
         (SELECT pg_get_constraintdef(oid) FROM pg_constraint
          WHERE conrelid = 'quote_elements'::regclass AND contype = 'c'
            AND pg_get_constraintdef(oid) ILIKE '%kind%' LIMIT 1),
         'NEE - geen CHECK gevonden'
       ) AS uitkomst

UNION ALL SELECT 'Elementtypes factuur',
       COALESCE(
         (SELECT pg_get_constraintdef(oid) FROM pg_constraint
          WHERE conrelid = 'invoice_elements'::regclass AND contype = 'c'
            AND pg_get_constraintdef(oid) ILIKE '%kind%' LIMIT 1),
         'NEE - geen CHECK gevonden'
       )

UNION ALL SELECT 'Blokken opgeschoond',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name IN ('quote_blocks', 'invoice_blocks')
           AND column_name = 'kind'
       ) THEN 'NEE - onderdeel 1 is halverwege gebleven' ELSE 'ja' END

UNION ALL SELECT 'Regels hangen aan een element',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name IN ('quote_items', 'invoice_items')
           AND column_name = 'block_id'
       ) THEN 'NEE - onderdeel 1 is halverwege gebleven' ELSE 'ja' END

UNION ALL SELECT 'Versturen en ondertekenen',
       CASE WHEN (
         SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'quotes'
           AND column_name IN ('public_token', 'sent_at', 'signed_at', 'signed_name', 'signature_image')
       ) = 5 THEN 'ja - 5 van 5 kolommen' ELSE 'NEE - onderdeel 3 niet gelukt' END

UNION ALL SELECT 'E-mail en nummering',
       CASE WHEN (
         SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'tenants'
           AND column_name IN ('email_from', 'quote_email_subject', 'quote_email_intro_text',
                               'invoice_email_subject', 'invoice_email_intro_text',
                               'quote_number_next', 'invoice_number_next')
       ) = 7 THEN 'ja - 7 van 7 kolommen' ELSE 'NEE - onderdeel 4 niet gelukt' END;
