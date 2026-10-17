-- ============================================================
-- Synbased - migraties
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

-- ------------------------------------------------------------
-- 6. Inbox: een gekoppelde mailbox per gebruiker
--
-- Alleen de sleutels om bij Gmail of Outlook te komen, versleuteld. De mail
-- zelf wordt elke keer daar opgehaald en niet bij ons bewaard.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mail_accounts (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Eén mailbox per gebruiker; het is zijn eigen mail, niet die van het bedrijf
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
  email TEXT NOT NULL,
  -- Versleuteld met MAIL_ENCRYPTION_KEY; zonder die sleutel is hier niets mee te doen
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mail_accounts_tenant_id_idx ON mail_accounts(tenant_id);

DROP TRIGGER IF EXISTS update_mail_accounts_updated_at ON mail_accounts;
CREATE TRIGGER update_mail_accounts_updated_at
  BEFORE UPDATE ON mail_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE mail_accounts ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 7. AI: een eigen sleutel per gebruiker voor Anthropic, OpenAI of Gemini
--
-- Om een mail om te zetten naar een offerte. Versleuteld, net als de mail.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_accounts (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Eén AI-koppeling per gebruiker, met zijn eigen sleutel: hij betaalt zelf
  -- (Gemini heeft een gratis laag, handig om te testen)
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai', 'gemini')),
  -- Versleuteld met MAIL_ENCRYPTION_KEY, net als de mailtoegang
  api_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_accounts_tenant_id_idx ON ai_accounts(tenant_id);

-- Wie dit onderdeel al eerder draaide, heeft een tabel zonder Gemini
ALTER TABLE ai_accounts DROP CONSTRAINT IF EXISTS ai_accounts_provider_check;
ALTER TABLE ai_accounts ADD CONSTRAINT ai_accounts_provider_check
  CHECK (provider IN ('anthropic', 'openai', 'gemini'));

DROP TRIGGER IF EXISTS update_ai_accounts_updated_at ON ai_accounts;
CREATE TRIGGER update_ai_accounts_updated_at
  BEFORE UPDATE ON ai_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE ai_accounts ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 8. WhatsApp: offertes maken met een bericht aan de bot
--
-- Per gebruiker het mobiele nummer waarmee hij de bot van Synbased berichten
-- stuurt, en de ids van berichten die al verwerkt zijn.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Eén mobiel nummer per gebruiker; berichten daarvan aan de bot worden zijn offertes
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  -- Alleen cijfers met landcode, zoals WhatsApp het doorgeeft (31612345678).
  -- Uniek: aan dit nummer herkent de bot van wie een bericht is
  phone TEXT NOT NULL UNIQUE,
  -- Een bericht waar nog een klant bij ontbrak; het volgende bericht vult het aan
  pending_text TEXT,
  pending_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wie dit onderdeel al eerder draaide, heeft een eerdere opzet: met een
-- koppelcode, of met een eigen app bij Meta per gebruiker. Die kolommen gaan
-- eruit; een rij zonder nummer kan niets en verdwijnt
ALTER TABLE whatsapp_accounts DROP COLUMN IF EXISTS link_code;
ALTER TABLE whatsapp_accounts DROP COLUMN IF EXISTS link_code_expires_at;
ALTER TABLE whatsapp_accounts DROP COLUMN IF EXISTS bot_number;
ALTER TABLE whatsapp_accounts DROP COLUMN IF EXISTS phone_number_id;
ALTER TABLE whatsapp_accounts DROP COLUMN IF EXISTS access_token;
ALTER TABLE whatsapp_accounts DROP COLUMN IF EXISTS app_secret;
ALTER TABLE whatsapp_accounts DROP COLUMN IF EXISTS verify_token;
ALTER TABLE whatsapp_accounts DROP COLUMN IF EXISTS webhook_verified_at;
DELETE FROM whatsapp_accounts WHERE phone IS NULL;
ALTER TABLE whatsapp_accounts ALTER COLUMN phone SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_phone_key ON whatsapp_accounts(phone);

CREATE INDEX IF NOT EXISTS whatsapp_accounts_tenant_id_idx ON whatsapp_accounts(tenant_id);

DROP TRIGGER IF EXISTS update_whatsapp_accounts_updated_at ON whatsapp_accounts;
CREATE TRIGGER update_whatsapp_accounts_updated_at
  BEFORE UPDATE ON whatsapp_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- De berichten die al verwerkt zijn, op het id van WhatsApp. Meta stuurt een
-- bericht soms twee keer; zo wordt het maar één offerte. Alleen het id staat
-- hier, niet wat erin stond.
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 9. Tweestapsverificatie met een authenticator-app
--
-- Per gebruiker de geheime sleutel van de app (versleuteld met
-- MAIL_ENCRYPTION_KEY), sinds wanneer het aan staat, de laatst gebruikte
-- tijdstap zodat een code maar één keer werkt, en de back-upcodes als hash.
-- Staat er wel een sleutel maar geen datum, dan is iemand halverwege het
-- aanzetten en telt het nog niet.
-- ------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_counter BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[];

-- ------------------------------------------------------------
-- 10. Wachtwoord vergeten en een slot op te veel inlogpogingen
--
-- Een herstellink is eenmalig en een uur geldig; alleen een hash van de
-- sleutel staat hier. En per e-mailadres een teller van mislukte pogingen, zodat
-- niemand eindeloos wachtwoorden of codes kan proberen.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Alleen een hash: wie de database inziet, kan er geen wachtwoord mee herstellen
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets(user_id);

-- Mislukte pogingen per sleutel, zoals "login:naam@voorbeeld.nl". Na te veel
-- pogingen binnen korte tijd staat de sleutel even op slot
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ
);

ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 11. Offertes opvolgen: geopend door de klant, en een herinnering
--
-- Wanneer de klant de offerte voor het eerst en het laatst opende en hoe
-- vaak, wie hem verstuurde (de herinnering gaat vanuit diens mailbox), en
-- of de herinnering al weg is. Per aannemer na hoeveel dagen zonder
-- handtekening de herinnering gaat; leeg is geen herinnering.
-- ------------------------------------------------------------
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS quote_reminder_days INTEGER;

-- ------------------------------------------------------------
-- 12. Betalen: QR-code, factuur versturen en Mollie
--
-- Een factuur krijgt een betaaldatum (de omzet telt vanaf die dag), een eigen
-- sleutel voor de pagina waar de klant hem bekijkt en betaalt, wie en wanneer
-- hem verstuurde, en de laatste Mollie-betaling. Facturen die al betaald
-- waren, krijgen hun laatste wijziging als betaaldatum.
-- ------------------------------------------------------------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS public_token UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS mollie_payment_id TEXT;

UPDATE invoices SET paid_at = updated_at WHERE status = 'paid' AND paid_at IS NULL;
UPDATE invoices SET public_token = gen_random_uuid() WHERE public_token IS NULL;
ALTER TABLE invoices ALTER COLUMN public_token SET DEFAULT gen_random_uuid();
ALTER TABLE invoices ALTER COLUMN public_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_public_token_idx ON invoices(public_token);
CREATE INDEX IF NOT EXISTS invoices_mollie_payment_id_idx ON invoices(mollie_payment_id);

CREATE TABLE IF NOT EXISTS mollie_accounts (
  id BIGSERIAL PRIMARY KEY,
  -- Eén Mollie-account per bedrijf: het geld gaat naar de rekening van de aannemer
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  -- Versleuteld met MAIL_ENCRYPTION_KEY, net als de mail- en AI-sleutels
  api_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_mollie_accounts_updated_at ON mollie_accounts;
CREATE TRIGGER update_mollie_accounts_updated_at
  BEFORE UPDATE ON mollie_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE mollie_accounts ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 13. Producten: vaste posten met prijs en eenheid
--
-- Werk en materiaal dat een aannemer vaak gebruikt, zoals "Uurloon" of "m²
-- tegelwerk". In de prijstabel kies je er een uit; de regel krijgt dan een
-- kopie, dus een latere prijswijziging verandert oude offertes niet.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT,
  -- Prijs per eenheid, exclusief btw, zoals in de prijstabel
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_tenant_id_idx ON products(tenant_id);

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 14. Papierformaat per bedrijf
--
-- Staand of liggend A4, voor offertes en facturen. Geldt voor elk sjabloon:
-- het vel zelf regelt de app, een sjabloon alleen de opmaak erbinnen.
-- ------------------------------------------------------------
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS paper_orientation TEXT NOT NULL DEFAULT 'portrait';
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_paper_orientation_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_paper_orientation_check
  CHECK (paper_orientation IN ('portrait', 'landscape'));

-- ------------------------------------------------------------
-- 15. Aantal en eenheid per prijstabel aan of uit
--
-- Per prijstabel de keuze of de kolommen Aantal, Eenheid en Prijs per stuk
-- erbij staan. Bestaande tabellen die al aantallen of eenheden gebruiken,
-- zetten we meteen aan; de rest blijft "Omschrijving · Bedrag" zoals nu.
-- ------------------------------------------------------------
ALTER TABLE quote_elements ADD COLUMN IF NOT EXISTS show_quantity BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE invoice_elements ADD COLUMN IF NOT EXISTS show_quantity BOOLEAN NOT NULL DEFAULT false;

UPDATE quote_elements e SET show_quantity = true
WHERE e.kind = 'prijstabel' AND NOT e.show_quantity AND EXISTS (
  SELECT 1 FROM quote_items i
  WHERE i.element_id = e.id AND NOT i.is_heading AND (i.unit IS NOT NULL OR i.quantity <> 1)
);
UPDATE invoice_elements e SET show_quantity = true
WHERE e.kind = 'prijstabel' AND NOT e.show_quantity AND EXISTS (
  SELECT 1 FROM invoice_items i
  WHERE i.element_id = e.id AND NOT i.is_heading AND (i.unit IS NOT NULL OR i.quantity <> 1)
);

-- ------------------------------------------------------------
-- 16. Creditfacturen
--
-- Een verstuurde factuur mag niet meer veranderen; een fout herstel je met
-- een creditfactuur. Die verwijst naar de factuur die hij (deels) terugdraait.
-- ------------------------------------------------------------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credit_for_invoice_id BIGINT REFERENCES invoices(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS invoices_credit_for_invoice_id_idx ON invoices(credit_for_invoice_id);

-- De rechten opnieuw, zodat de nieuwe tabellen ze ook hebben
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;

-- Laat Supabase de nieuwe tabellen meteen kennen. Zonder dit zegt de API soms
-- nog even "Could not find the table ... in the schema cache"
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- Controle achteraf
--
-- Eén opdracht, want de SQL-editor toont alleen de uitkomst van de laatste.
-- Er horen zeventien regels uit te komen die allemaal met "ja" beginnen. Staat er
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
       ) = 7 THEN 'ja - 7 van 7 kolommen' ELSE 'NEE - onderdeel 4 niet gelukt' END

UNION ALL SELECT 'Inbox',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'mail_accounts'
       ) THEN 'ja' ELSE 'NEE - onderdeel 6 niet gelukt' END

UNION ALL SELECT 'AI',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'ai_accounts'
       ) THEN 'ja' ELSE 'NEE - onderdeel 7 niet gelukt' END

UNION ALL SELECT 'WhatsApp',
       CASE WHEN (
         SELECT count(*) FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name IN ('whatsapp_accounts', 'whatsapp_messages')
       ) = 2 THEN 'ja' ELSE 'NEE - onderdeel 8 niet gelukt' END

UNION ALL SELECT 'Tweestapsverificatie',
       CASE WHEN (
         SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'users'
           AND column_name IN ('totp_secret', 'totp_enabled_at', 'totp_last_counter', 'totp_backup_codes')
       ) = 4 THEN 'ja - 4 van 4 kolommen' ELSE 'NEE - onderdeel 9 niet gelukt' END

UNION ALL SELECT 'Wachtwoord vergeten en inlogslot',
       CASE WHEN (
         SELECT count(*) FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name IN ('password_resets', 'login_attempts')
       ) = 2 THEN 'ja' ELSE 'NEE - onderdeel 10 niet gelukt' END

UNION ALL SELECT 'Offertes opvolgen',
       CASE WHEN (
         SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public'
           AND ((table_name = 'quotes' AND column_name IN ('viewed_at', 'last_viewed_at', 'view_count', 'sent_by', 'reminder_sent_at'))
             OR (table_name = 'tenants' AND column_name = 'quote_reminder_days'))
       ) = 6 THEN 'ja - 6 van 6 kolommen' ELSE 'NEE - onderdeel 11 niet gelukt' END

UNION ALL SELECT 'Betalen',
       CASE WHEN (
         SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'invoices'
           AND column_name IN ('paid_at', 'public_token', 'sent_at', 'sent_by', 'mollie_payment_id')
       ) = 5 AND EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'mollie_accounts'
       ) THEN 'ja' ELSE 'NEE - onderdeel 12 niet gelukt' END

UNION ALL SELECT 'Producten',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'products'
       ) THEN 'ja' ELSE 'NEE - onderdeel 13 niet gelukt' END

UNION ALL SELECT 'Papierformaat',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'paper_orientation'
       ) THEN 'ja' ELSE 'NEE - onderdeel 14 niet gelukt' END

UNION ALL SELECT 'Aantal en eenheid per prijstabel',
       CASE WHEN (
         SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name IN ('quote_elements', 'invoice_elements')
           AND column_name = 'show_quantity'
       ) = 2 THEN 'ja' ELSE 'NEE - onderdeel 15 niet gelukt' END

UNION ALL SELECT 'Creditfacturen',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'credit_for_invoice_id'
       ) THEN 'ja' ELSE 'NEE - onderdeel 16 niet gelukt' END;
