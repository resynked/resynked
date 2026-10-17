import SiteLayout from '@/components/site/SiteLayout';
import { ClosingSection, FaqSection, PricingSection } from '@/components/site/sections';

/** Prijzen op synbased.com: het abonnement, en de vragen die daarbij horen */
export default function Pricing() {
  return (
    <SiteLayout
      title="Prijzen"
      description="Synbased kost € 35 per maand, excl. btw: offertes, facturen, kosten, bank, btw-aangifte en jaarcijfers, met je mail en agenda erbij."
    >
      <section className="site-hero">
        <div className="site-container">
          <span className="site-pill">€ 35 per maand, excl. btw</span>
          <h1>Eén prijs. Alles erin.</h1>
          <p className="site-lead">
            Geen pakketten, geen extra modules om bij te kopen. Van offerte tot jaarcijfers zit alles in hetzelfde
            abonnement.
          </p>
        </div>
      </section>

      <PricingSection title="Wat je krijgt voor € 35 per maand." />

      <FaqSection />

      <ClosingSection />
    </SiteLayout>
  );
}
