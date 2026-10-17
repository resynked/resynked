# Synbased

Offerte- en factuursysteem voor aannemers. Elke aannemer heeft een eigen account
(tenant) met zijn eigen klanten, offertes en facturen; gegevens van verschillende
aannemers komen elkaar nooit tegen.

## Wat het systeem doet

- **Klanten** met contactpersonen, adres, KvK, BTW-nummer en IBAN
- **Offertes** met vrije regels: omschrijving, aantal, eenheid (stuks, uur, m², …) en prijs
- **Offerte omzetten naar factuur** met één knop; alle regels gaan mee
- **Facturen** met status concept / verzonden / betaald / geannuleerd
- **Offerte versturen** per mail: de klant krijgt een bericht met het logo, je
  eigen tekst uit Instellingen > E-mail en een knop naar een pagina waar hij de
  offerte kan bekijken en met vinger of muis kan **ondertekenen**
- **Notities** per klant
- **Producten**: vast werk en materiaal met prijs en eenheid, zoals uurloon of
  m² tegelwerk. In de prijstabel kies je er een met "Product toevoegen"; de
  regel krijgt een kopie, dus een prijswijziging verandert geen oude offertes.
  Vrij uitgeschreven regels blijven gewoon kunnen
- **Factuur versturen en betalen**: de klant krijgt een mail met de
  betaalgegevens en een QR-code (EPC/GiroCode) voor zijn bank-app, en een knop
  naar een pagina waar hij de factuur bekijkt. Met de optionele Mollie-plug-in
  betaalt hij daar direct met iDEAL en staat de factuur vanzelf op betaald
- **Omzetgrafiek** op het dashboard, gevoed door betaalde facturen op hun
  betaaldatum
- **Betalingsherinneringen**: staat het aan bij Instellingen > Facturen, dan
  krijgt een verstuurde factuur die het ingestelde aantal dagen over de
  vervaldatum is een herinnering met de betaalgegevens, en na nog eens zoveel
  dagen een tweede. Vanuit de mailbox van wie de factuur verstuurde
- **Btw-overzicht** per kwartaal of jaar: omzet en btw per tarief met de
  rubriek op de aangifte, op factuurdatum. De export is een CSV voor de
  boekhouder. Met de optionele Moneybird-plug-in gaat elke vastgelegde factuur
  (en zijn betaling) vanzelf naar de boekhouding

## Techniek

Next.js (pages router) · TypeScript · Supabase (Postgres) · NextAuth

Multi-tenancy loopt via `tenant_id` op elke tabel. De API-routes draaien op de
Supabase service role key en filteren zelf op de `tenantId` uit de NextAuth-sessie;
RLS-policies op de tabellen vormen de tweede laag.

## Opzetten

1. `npm install`
2. Maak `.env.local` met:

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   NEXTAUTH_SECRET=...
   NEXTAUTH_URL=http://localhost:3000

   # Het adres van de app, voor de link in de offertemail
   APP_URL=http://localhost:3000

   # Mail van Synbased zelf, zoals "Wachtwoord vergeten" (resend.com).
   # Het domein van de afzender moet bij Resend geverifieerd zijn
   RESEND_API_KEY=...
   # Optioneel; zonder dit wordt het noreply@ op het domein van APP_URL
   EMAIL_FROM="Synbased <noreply@synbased.com>"
   # Waar demo-aanvragen van de website naartoe gaan
   DEMO_REQUEST_EMAIL=info@synbased.com

   # Dagelijkse taken (vercel.json): herinneringen voor offertes en facturen.
   # Vercel stuurt dit mee; zonder deze waarde weigert de taak elke aanroep
   CRON_SECRET=...   # lange willekeurige tekst, bijv. `openssl rand -base64 32`

   # Inbox (Instellingen > Plug-ins)
   MAIL_ENCRYPTION_KEY=...   # lange willekeurige tekst, bijv. `openssl rand -base64 32`
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   MICROSOFT_CLIENT_ID=...
   MICROSOFT_CLIENT_SECRET=...

   # WhatsApp-bot van Synbased, voor iedereen hetzelfde (zie hieronder)
   WHATSAPP_VERIFY_TOKEN=...     # zelf verzonnen, zelfde als bij Meta bij de webhook
   WHATSAPP_TOKEN=...            # permanente token van een systeemgebruiker
   WHATSAPP_PHONE_NUMBER_ID=...  # het id van het nummer bij Meta, niet het nummer zelf
   WHATSAPP_APP_SECRET=...       # app-geheim, om binnenkomende berichten te controleren

   # Optioneel: welk model de AI-plug-ins gebruiken
   OPENAI_MODEL=...   # standaard gpt-5
   GEMINI_MODEL=...   # standaard gemini-flash-latest
   ```

   Offertes gaan per mail vanuit de Gmail of Outlook die een gebruiker bij
   **Instellingen > Plug-ins** koppelt (zie hieronder); zonder koppeling staat
   de knop Versturen er niet.

   `APP_URL` is het adres waarop de app te bereiken is; daarmee wordt de link in
   de mail opgebouwd. Op Vercel zet je die op de echte domeinnaam — zonder die
   variabele wijst de knop in de mail naar `localhost`. Staat `APP_URL` er niet,
   dan valt hij terug op `NEXTAUTH_URL`.

3. Draai [`SCHEMA.sql`](SCHEMA.sql) in de Supabase SQL-editor; dat bouwt de
   hele database op. Werk je een bestaande database bij, draai dan
   [`MIGRATION.sql`](MIGRATION.sql) — dat is het enige migratiebestand en mag
   zo vaak gedraaid worden als nodig
4. `npm run dev` en maak via `/register` het eerste account aan — daarmee
   ontstaat meteen de tenant

## Inbox koppelen

Gebruikers koppelen hun eigen Gmail- of Outlook-mailbox bij **Instellingen >
Plug-ins**. De mail wordt elke keer live bij Google of Microsoft opgehaald en niet
bij ons bewaard; alleen de toegangssleutels staan in `mail_accounts`, versleuteld
met `MAIL_ENCRYPTION_KEY`. Raak je die sleutel kwijt of verander je hem, dan moet
iedereen zijn Inbox opnieuw koppelen.

**Google** — in de [Google Cloud Console](https://console.cloud.google.com/):

1. Zet de **Gmail API** en de **Google Calendar API** aan.
2. Stel het OAuth-toestemmingsscherm in met de scopes
   `https://www.googleapis.com/auth/gmail.modify` en
   `https://www.googleapis.com/auth/calendar.events`.
3. Maak een OAuth-client van het type *Web application* met als redirect-URI
   `{APP_URL}/api/mail/callback/google`.

Zolang de app in Google op *Testing* staat, kunnen alleen de testgebruikers die
je daar invult koppelen. Voor iedereen moet de app door Google geverifieerd
worden; `gmail.modify` is een *restricted scope*, dus daar hoort een
beveiligingsbeoordeling bij.

**Microsoft** — in [Microsoft Entra](https://entra.microsoft.com/) bij *App
registrations*:

1. Nieuwe registratie, accounttype *Accounts in any organizational directory and
   personal Microsoft accounts*.
2. Redirect-URI's (platform *Web*): `{APP_URL}/api/mail/callback/microsoft` en
   `{APP_URL}/api/mail/admin-consent/done` (voor de link die een IT-beheerder
   gebruikt om Synbased voor zijn hele organisatie goed te keuren).
3. Onder *API permissions* (Microsoft Graph, delegated): `Mail.ReadWrite`,
   `Mail.Send`, `Calendars.ReadWrite`, `User.Read`, `offline_access`.
4. Onder *Certificates & secrets* een client secret aanmaken.

## AI: mail omzetten naar offerte

Bij **Instellingen > Plug-ins > AI** zet een gebruiker Anthropic, OpenAI of Google Gemini aan met
zijn **eigen API-sleutel**; het gebruik betaalt hij zelf bij die dienst. De
sleutel wordt bij het installeren geprobeerd en staat daarna versleuteld in
`ai_accounts` (met dezelfde `MAIL_ENCRYPTION_KEY` als de mailtoegang).

In de Inbox staat dan bij een gesprek de knop **Omzetten naar offerte**. De AI
leest het gesprek en stelt voor: de klant (een bestaande klant wordt op
e-mailadres herkend), de offerteregels met prijzen uit eerdere offertes van dit
bedrijf, wat er nog ontbreekt, en een antwoord aan de klant dat daarom vraagt.
Pas na controle maakt de gebruiker de klant en een conceptofferte aan; het
antwoord komt klaar te staan onderin het gesprek. De AI verzint geen prijzen:
zonder vergelijkbaar eerder werk blijft de prijs leeg.

Anthropic draait op Claude Opus 5.5 (`src/lib/ai/anthropic.ts`), OpenAI op
`OPENAI_MODEL` (`src/lib/ai/openai.ts`) en Gemini op `GEMINI_MODEL`
(`src/lib/ai/gemini.ts`); de opdracht is voor alle drie gelijk
(`src/lib/ai/prompt.ts`). Gemini heeft via Google AI Studio een gratis laag,
handig om te testen; Google mag gegevens uit die gratis laag gebruiken om hun
diensten te verbeteren.

## Database

| Tabel | Inhoud |
| --- | --- |
| `tenants`, `users` | accounts per aannemer |
| `customers`, `contact_persons` | relaties |
| `quotes`, `quote_items` | offertes met vrije regels |
| `invoices`, `invoice_items` | facturen met vrije regels |
| `notes` | notities per klant |
| `mollie_accounts`, `moneybird_accounts` | plug-ins voor betalen en boekhouding, met versleutelde sleutel |

Een offerte die is omgezet houdt `converted_to_invoice_id` vast; de factuur
verwijst met `quote_id` terug.

## WhatsApp: offerte maken met een bericht

Synbased heeft één WhatsApp-nummer, de bot, met één app bij Meta. De gegevens
daarvan staan in de omgevingsvariabelen en gelden voor iedereen. Bij
**Instellingen > Plug-ins > WhatsApp** ziet een gebruiker het nummer van de bot
en (ingekort) de token, maar kan hij ze niet wijzigen; hij vult alleen zijn
**eigen mobiele nummer** in. Aan dat nummer herkent de bot van wie een bericht
is, dus één nummer hoort bij één gebruiker.

Daarna kan hij bij een klant gewoon appen wat hij ziet of opmeet:

> Keuken 25 m² muren schilderen, plafond 12 m² sauzen. Klant Jan de Vries,
> Dorpsstraat 1, 1234 AB Utrecht, 06 12345678

De bot laat de AI-plug-in van de gebruiker (die moet dus ook aan staan) de klant
en de regels uitlezen, met prijzen uit eerdere offertes of uit het bericht zelf.
De klant wordt herkend op e-mailadres, telefoonnummer, of naam met postcode;
lege velden van een bestaande klant worden aangevuld. Is de klant onbekend, dan
komt er een nieuwe klant. De offerte wordt als **concept** aangemaakt en de
gebruiker krijgt een samenvatting met een link terug. Noemt het bericht geen
klant, dan vraagt de bot erom en neemt hij het volgende bericht (binnen een uur)
erbij. `stop` wist zo'n half afgemaakte offerte, `help` geeft een voorbeeld.
Alleen tekstberichten; spraakberichten en foto's worden (nog) niet gelezen.

Instellen bij [Meta for Developers](https://developers.facebook.com/), eenmalig
voor heel Synbased:

1. Maak een app van het type *Business* en voeg het product **WhatsApp** toe.
2. Koppel het telefoonnummer van de bot: één nummer voor alle gebruikers, dat
   nog niet in de gewone WhatsApp-app gebruikt wordt. `WHATSAPP_PHONE_NUMBER_ID`
   staat bij *WhatsApp > API Setup*.

   Om te testen kan het **testnummer** van Meta uit API Setup. Dat kan alleen
   antwoorden naar hooguit vijf nummers die je daar bij *To* toevoegt en
   bevestigt; voeg dus de mobiele nummers toe waarmee je test, anders komt het
   antwoord van de bot niet aan.
3. Maak in Business Settings een *systeemgebruiker* met de rechten
   `whatsapp_business_messaging` en `whatsapp_business_management`, en genereer
   daarmee een permanente token voor `WHATSAPP_TOKEN`. (De tijdelijke token uit
   API Setup verloopt na een dag.)
4. Het app-geheim (`WHATSAPP_APP_SECRET`) staat bij *App settings > Basic*.
5. Zet `WHATSAPP_VERIFY_TOKEN` op Vercel en **deploy opnieuw**; een nieuwe
   omgevingsvariabele werkt pas na een nieuwe deploy. Vul daarna bij
   *WhatsApp > Configuration* als callback-URL `{APP_URL}/api/whatsapp/webhook`
   in, met hetzelfde verify token, en abonneer op het veld `messages`.

   Controleren kan vooraf in de browser:
   `{APP_URL}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=12345`
   hoort `12345` terug te geven. Een 403 betekent dat het token niet klopt of
   nog niet gedeployed is.

De bot antwoordt alleen op berichten die de gebruiker zelf stuurt, binnen het
venster van 24 uur dat WhatsApp daarvoor geeft; er zijn dus geen goedgekeurde
berichtsjablonen nodig. Met `WHATSAPP_API_VERSION` kies je eventueel een andere
versie van de Graph API (standaard `v23.0`). Draai na het bijwerken onderdeel 8
van [`MIGRATION.sql`](MIGRATION.sql) (of het hele bestand).
