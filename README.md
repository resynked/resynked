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
