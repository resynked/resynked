import Link from 'next/link';
import SiteLayout from '@/components/site/SiteLayout';

/**
 * De privacyverklaring. Google vraagt hierom voor de koppeling met Gmail, en
 * de tekst over Google-gegevens ("Limited Use") moet erin blijven staan.
 *
 * Concept: laat dit nakijken door een jurist voordat Khance live gaat.
 */
export default function Privacy() {
  return (
    <SiteLayout title="Privacyverklaring" description="Hoe Khance omgaat met je gegevens en die van je klanten.">
      <section className="site-section">
        <article className="site-container site-narrow site-legal">
          <span className="site-eyebrow">Juridisch</span>
          <h1>Privacyverklaring</h1>
          <p className="placeholder">Laatst bijgewerkt: 16 oktober 2026</p>

          <p>
            Khance is een online programma voor offertes, facturen, klanten, mail en agenda. In deze verklaring lees je
            welke gegevens we verwerken, waarom, en wat je rechten zijn.
          </p>

          <h2>Wie we zijn</h2>
          <p>
            Khance, ingeschreven bij de Kamer van Koophandel onder nummer [KvK-nummer], gevestigd aan [adres]. Vragen
            over privacy stuur je naar <a href="mailto:info@khance.com">info@khance.com</a>.
          </p>

          <h2>Twee rollen</h2>
          <p>
            Voor je eigen account (je naam, e-mailadres en wachtwoord) en voor demo-aanvragen zijn wij
            verwerkingsverantwoordelijke. De gegevens die jij in Khance zet over je klanten, zoals namen, adressen,
            offertes en facturen, verwerken we in opdracht van jou: dan ben jij verantwoordelijk en zijn wij
            verwerker. De afspraken daarover staan in de verwerkersovereenkomst, die onderdeel is van de{' '}
            <Link href="/terms">algemene voorwaarden</Link>.
          </p>

          <h2>Welke gegevens en waarom</h2>
          <ul>
            <li>
              <strong>Account:</strong> naam, e-mailadres, een versleutelde vorm van je wachtwoord en, als je die
              aanzet, de sleutel voor tweestapsverificatie. Nodig om in te loggen en je account te beveiligen.
            </li>
            <li>
              <strong>Bedrijfsgegevens:</strong> bedrijfsnaam, adres, KvK, btw-nummer, IBAN en logo. Nodig om ze op je
              offertes en facturen te zetten.
            </li>
            <li>
              <strong>Klanten, offertes en facturen:</strong> wat jij invult. Nodig om de dienst te leveren.
            </li>
            <li>
              <strong>Inlogpogingen:</strong> tijdelijk, om te voorkomen dat iemand je wachtwoord raadt.
            </li>
            <li>
              <strong>Demo-aanvragen:</strong> naam, bedrijf, e-mail, telefoon en je bericht. Alleen om contact met je
              op te nemen.
            </li>
          </ul>

          <h2>Je mailbox en agenda (Google en Microsoft)</h2>
          <p>
            Koppel je Gmail of Outlook, dan leest Khance je mail en agenda om ze in Khance te tonen, en verstuurt het
            offertes, facturen en antwoorden vanaf jouw adres. De toegangssleutels slaan we versleuteld op. Je kunt de
            koppeling op elk moment verbreken in Instellingen &gt; Plug-ins, en intrekken bij Google of Microsoft.
          </p>
          <p>
            Het gebruik en het doorgeven van gegevens die Khance van Google API&rsquo;s ontvangt, voldoet aan het{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
              Google API Services User Data Policy
            </a>
            , inclusief de eisen voor beperkt gebruik (Limited Use). We gebruiken deze gegevens alleen voor de functies
            die jij in Khance ziet, verkopen ze niet, gebruiken ze niet voor advertenties en niet om AI-modellen te
            trainen.
          </p>

          <h2>AI</h2>
          <p>
            Zet je een mail of WhatsApp-bericht om naar een offerte, dan sturen we die tekst en je producten naar een
            AI-dienst (Anthropic, OpenAI of Google) om een concept te maken. Die partijen gebruiken de gegevens niet om
            hun modellen te trainen.
          </p>

          <h2>Met wie we gegevens delen</h2>
          <p>We verkopen geen gegevens. We werken met deze dienstverleners, die alleen doen wat nodig is voor Khance:</p>
          <ul>
            <li>Vercel (hosting van de website en de app)</li>
            <li>Supabase (database en opslag van bestanden)</li>
            <li>Resend (mail van Khance zelf, zoals een nieuw wachtwoord)</li>
            <li>Google en Microsoft (als je je mailbox koppelt)</li>
            <li>Meta (als je offertes via WhatsApp maakt)</li>
            <li>Mollie (als je betalingen via Mollie koppelt)</li>
            <li>Anthropic, OpenAI of Google (AI, zie hierboven)</li>
          </ul>
          <p>
            Sommige van deze partijen zitten buiten de Europese Unie. Daarvoor gelden passende waarborgen, zoals de
            standaardcontractbepalingen van de Europese Commissie of het EU-VS Data Privacy Framework.
          </p>

          <h2>Hoe lang we gegevens bewaren</h2>
          <p>
            Zolang je account bestaat. Na het opzeggen verwijderen we je gegevens binnen [termijn], behalve wat we
            wettelijk langer moeten bewaren. Facturen moet jij zelf zeven jaar bewaren; download ze dus voordat je
            opzegt. Demo-aanvragen zonder vervolg verwijderen we na [termijn].
          </p>

          <h2>Beveiliging</h2>
          <p>
            Verbindingen zijn versleuteld (https), wachtwoorden slaan we alleen gehasht op, mailtoegang versleuteld, en
            je kunt tweestapsverificatie aanzetten. Te veel mislukte inlogpogingen zetten een account tijdelijk op slot.
          </p>

          <h2>Je rechten</h2>
          <p>
            Je mag je gegevens inzien, laten verbeteren of verwijderen, bezwaar maken, de verwerking laten beperken en
            je gegevens meenemen. Mail ons via <a href="mailto:info@khance.com">info@khance.com</a>; we reageren binnen
            een maand. Ben je het niet met ons eens, dan kun je een klacht indienen bij de Autoriteit Persoonsgegevens.
          </p>

          <h2>Cookies</h2>
          <p>
            Khance gebruikt alleen cookies die nodig zijn om in te loggen. We gebruiken geen advertentie- of
            volgcookies.
          </p>

          <h2>Wijzigingen</h2>
          <p>Verandert deze verklaring, dan passen we de datum bovenaan aan. Grote wijzigingen melden we per mail.</p>
        </article>
      </section>
    </SiteLayout>
  );
}
