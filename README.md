# Resynked

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
- **Omzetgrafiek** op het dashboard, gevoed door betaalde facturen

Er is bewust geen artikelen- of productenbestand: een aannemer schrijft zijn
regels vrij uit.

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

   # Offertes versturen
   RESEND_API_KEY=...
   EMAIL_FROM=Resynked <offertes@jouwdomein.nl>
   APP_URL=http://localhost:3000

   # Inbox (Instellingen > Plug-ins)
   MAIL_ENCRYPTION_KEY=...   # lange willekeurige tekst, bijv. `openssl rand -base64 32`
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   MICROSOFT_CLIENT_ID=...
   MICROSOFT_CLIENT_SECRET=...

   # Optioneel: welk OpenAI-model de AI-plug-in gebruikt (standaard gpt-5)
   OPENAI_MODEL=...
   ```

   Deze drie zijn systeembreed. Het afzendadres per aannemer staat niet hier
   maar in de app, bij **Instellingen > E-mail**; `EMAIL_FROM` is het adres
   waarop wordt teruggevallen als een aannemer daar niets invult.

   Elk afzendadres — dat van de aannemer én `EMAIL_FROM` — moet op een domein
   zitten dat in Resend geverifieerd is, anders weigert Resend de mail. Wil een
   aannemer vanaf zijn eigen domein versturen, dan moet dat domein er in Resend
   bij, met de DNS-records die Resend aangeeft.

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
   gebruikt om Resynked voor zijn hele organisatie goed te keuren).
3. Onder *API permissions* (Microsoft Graph, delegated): `Mail.ReadWrite`,
   `Mail.Send`, `Calendars.ReadWrite`, `User.Read`, `offline_access`.
4. Onder *Certificates & secrets* een client secret aanmaken.

## AI: mail omzetten naar offerte

Bij **Instellingen > Plug-ins > AI** zet een gebruiker Anthropic of OpenAI aan met
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
`OPENAI_MODEL` (`src/lib/ai/openai.ts`); de opdracht is voor beide gelijk
(`src/lib/ai/prompt.ts`).

## Database

| Tabel | Inhoud |
| --- | --- |
| `tenants`, `users` | accounts per aannemer |
| `customers`, `contact_persons` | relaties |
| `quotes`, `quote_items` | offertes met vrije regels |
| `invoices`, `invoice_items` | facturen met vrije regels |
| `notes` | notities per klant |

Een offerte die is omgezet houdt `converted_to_invoice_id` vast; de factuur
verwijst met `quote_id` terug.
