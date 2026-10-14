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


- `APP_URL` zonder slash aan het eind.
- `MAIL_ENCRYPTION_KEY` genereer je met `openssl rand -base64 32`. Verander of
  verlies deze sleutel niet: dan moet iedereen zijn inbox opnieuw koppelen. Bewaar
  hem in een wachtwoordmanager.

### Google

In de [Google Cloud Console](https://console.cloud.google.com/):

1. **APIs & Services → Library**: zet de **Gmail API** en de **Google Calendar
   API** aan.
2. **Google Auth Platform**: stel het toestemmingsscherm in met audience
   *External*.
3. **Data Access → Add or remove scopes**: voeg handmatig toe:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/calendar.readonly`
4. **Clients → Create client**, type *Web application*, met als redirect-URI
   `{APP_URL}/api/mail/callback/google`. Voor lokaal testen ook
   `http://localhost:3000/api/mail/callback/google`.
5. Zet de Client ID en het Client secret in `GOOGLE_CLIENT_ID` en
   `GOOGLE_CLIENT_SECRET`.

**Testing vs. productie**

- Op *Testing* kunnen alleen de adressen onder **Audience → Test users** koppelen
  (max. 100). Ze krijgen een "unverified app"-waarschuwing en de koppeling
  verloopt na 7 dagen.
- **Google Workspace-klanten**: zet de app op *In production* (Publish app,
  zonder verificatie). De Workspace-beheerder van de klant zet Resynked op
  *Trusted* in admin.google.com → Security → Access and data control → API
  controls → Manage Third-Party App Access → Configure new app (zoeken op Client
  ID). Daarna werkt het voor het hele domein zonder waarschuwing of verloopdatum.
- **Losse @gmail.com-gebruikers**: daarvoor moet de app door Google geverifieerd
  worden. `gmail.modify` is een *restricted scope*, dus dat vereist een eigen
  domein, privacybeleid, een demovideo en een jaarlijkse CASA-
  beveiligingsbeoordeling.

### Microsoft

In [Microsoft Entra](https://entra.microsoft.com/) bij **App registrations**:

1. **New registration**, accounttype *Accounts in any organizational directory
   and personal Microsoft accounts*. Staat er al *Alleen mijn organisatie*? Pas
   het aan bij **Authentication → Supported accounts**. Geeft dat een fout, zet
   dan eerst in **Manifest** `"requestedAccessTokenVersion": 2`.
2. **Redirect-URI's** (platform *Web*):
   - `{APP_URL}/api/mail/callback/microsoft`
   - `{APP_URL}/api/mail/admin-consent/done` (voor de link waarmee een
     IT-beheerder Resynked voor zijn hele organisatie goedkeurt)
   - Optioneel lokaal: `http://localhost:3000/api/mail/callback/microsoft`
3. **API permissions** (Microsoft Graph, delegated): `Mail.ReadWrite`,
   `Mail.Send`, `Calendars.Read`, `User.Read`, `offline_access`.
4. **Certificates & secrets**: maak een client secret aan en kopieer direct de
   *Value*, want die is maar één keer zichtbaar.
5. Zet de Application (client) ID en de secret-waarde in `MICROSOFT_CLIENT_ID` en
   `MICROSOFT_CLIENT_SECRET`.

Gebruik als tenant `common`, niet de tenant-ID van je eigen directory.

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
