import Link from 'next/link';
import SiteLayout from '@/components/site/SiteLayout';

/**
 * De algemene voorwaarden, met de verwerkersovereenkomst erin.
 *
 * Concept: laat dit nakijken door een jurist voordat Khance live gaat.
 */
export default function Terms() {
  return (
    <SiteLayout title="Algemene voorwaarden" description="De algemene voorwaarden van Khance.">
      <section className="site-section">
        <article className="site-container site-narrow site-legal">
          <span className="site-eyebrow">Juridisch</span>
          <h1>Algemene voorwaarden</h1>
          <p className="placeholder">Laatst bijgewerkt: 16 oktober 2026</p>

          <h2>1. Wie en wat</h2>
          <p>
            Deze voorwaarden gelden voor het gebruik van Khance, een online programma van Khance, ingeschreven bij de
            Kamer van Koophandel onder nummer [KvK-nummer] (&ldquo;wij&rdquo;). Ze gelden tussen ons en het bedrijf dat
            een account afneemt (&ldquo;jij&rdquo;). Khance is bedoeld voor zakelijk gebruik.
          </p>

          <h2>2. Het abonnement</h2>
          <p>
            Khance kost € 35 per maand, exclusief btw, per account. We factureren [maandelijks vooraf]. Het abonnement
            loopt [per maand en is maandelijks opzegbaar]. Prijswijzigingen melden we minstens een maand van tevoren.
          </p>

          <h2>3. Je account</h2>
          <p>
            Je houdt je inloggegevens geheim en bent verantwoordelijk voor wat er met je account gebeurt. Vermoed je
            misbruik, meld het dan direct. We raden aan tweestapsverificatie aan te zetten.
          </p>

          <h2>4. Jouw gegevens</h2>
          <p>
            Alles wat je in Khance zet, blijft van jou. Je bent zelf verantwoordelijk voor de inhoud van je offertes en
            facturen, en voor het bewaren ervan zolang de wet dat vraagt. Je kunt ze altijd als PDF downloaden.
          </p>

          <h2>5. Verwerkersovereenkomst</h2>
          <p>
            Over je klanten verwerken we persoonsgegevens in jouw opdracht. Daarvoor geldt: we verwerken ze alleen om
            Khance te leveren en volgens jouw instructies; onze medewerkers en dienstverleners zijn tot geheimhouding
            verplicht; we nemen passende beveiligingsmaatregelen; we schakelen alleen de dienstverleners in die in de{' '}
            <Link href="/privacy">privacyverklaring</Link> staan en melden nieuwe vooraf; we helpen je bij verzoeken van
            betrokkenen; een datalek melden we zonder onnodige vertraging; en na het einde van het abonnement
            verwijderen we de gegevens.
          </p>

          <h2>6. Beschikbaarheid</h2>
          <p>
            We doen ons best om Khance altijd bereikbaar te houden, maar kunnen dat niet garanderen. Onderhoud plannen
            we zoveel mogelijk buiten werktijden.
          </p>

          <h2>7. Koppelingen met anderen</h2>
          <p>
            Koppel je Gmail, Outlook, WhatsApp of Mollie, dan gelden ook de voorwaarden van die partijen. Voor hun
            diensten zijn wij niet verantwoordelijk. Betalingen van je klanten gaan rechtstreeks naar jou; Khance
            beheert geen geld.
          </p>

          <h2>8. AI</h2>
          <p>
            Concepten die met AI zijn gemaakt, zijn een voorstel. Kijk ze na voordat je ze verstuurt; jij bent
            verantwoordelijk voor de prijzen en teksten die je je klant stuurt.
          </p>

          <h2>9. Aansprakelijkheid</h2>
          <p>
            Onze aansprakelijkheid is beperkt tot directe schade en tot ten hoogste het bedrag dat je in de twaalf
            maanden daarvoor voor Khance betaalde, behalve bij opzet of grove schuld.
          </p>

          <h2>10. Opzeggen en beëindigen</h2>
          <p>
            Je kunt opzeggen per mail aan <a href="mailto:info@khance.com">info@khance.com</a>. Bij ernstig misbruik of
            niet betalen mogen wij je account na een waarschuwing stopzetten.
          </p>

          <h2>11. Wijzigingen en recht</h2>
          <p>
            Wijzigen we deze voorwaarden, dan melden we dat minstens een maand van tevoren. Op deze voorwaarden is
            Nederlands recht van toepassing.
          </p>
        </article>
      </section>
    </SiteLayout>
  );
}
