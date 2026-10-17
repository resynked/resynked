import SiteLayout from '@/components/site/SiteLayout';
import { ClosingSection, FAQ, FaqSection, MORE_FAQ } from '@/components/site/sections';

/** Veelgestelde vragen op synbased.com, over het product en over de boekhouding */
export default function Questions() {
  return (
    <SiteLayout
      title="Veelgestelde vragen"
      description="Antwoorden op veelgestelde vragen over Synbased: voor wie het is, je huisstijl, mail, betalen, de boekhouding en veiligheid."
    >
      <section className="site-hero">
        <div className="site-container">
          <span className="site-pill">Vragen</span>
          <h1>Veelgestelde vragen.</h1>
          <p className="site-lead">Staat je vraag er niet bij? Vraag een demo aan, dan beantwoorden we hem persoonlijk.</p>
        </div>
      </section>

      <FaqSection items={FAQ} title="Over Synbased" />

      <FaqSection items={MORE_FAQ} title="Boekhouding en veiligheid" />

      <ClosingSection title="Nog vragen?" />
    </SiteLayout>
  );
}
