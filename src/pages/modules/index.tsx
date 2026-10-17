import Link from 'next/link';
import SiteLayout from '@/components/site/SiteLayout';
import { MODULES, MODULE_GROUPS, ModuleCell, type SiteModule } from '@/components/site/modules';

/** De modules van één soort, per groep een kopje met een raster eronder */
function ModuleGroups({ kind }: { kind: SiteModule['kind'] }) {
  return (
    <>
      {MODULE_GROUPS.map((group) => {
        const modules = MODULES.filter(m => m.kind === kind && m.group === group);
        if (modules.length === 0) return null;
        return (
          <div key={group} className="site-group">
            <h3>{group}</h3>
            <div className="site-grid">
              {modules.map((module) => (
                <ModuleCell key={module.slug} module={module} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * Modules op synbased.com: alles wat standaard in Synbased zit, en de
 * plug-ins die je erbij aanzet. Elk blok opent een eigen pagina.
 */
export default function Modules() {
  return (
    <SiteLayout
      title="Modules"
      description="Alle modules van Synbased: offertes, facturen, kosten, bank, btw-aangifte en jaarcijfers, en plug-ins voor Gmail, Outlook, WhatsApp, AI, Mollie en je bank."
    >
      <section className="site-hero">
        <div className="site-container">
          <span className="site-pill">
            {MODULES.length} modules, één abonnement
          </span>
          <h1>Alles voor je bedrijf. Op één plek.</h1>
          <p className="site-lead">
            Van offerte tot jaarcijfers zit alles standaard in Synbased. Met plug-ins koppel je je mail, je bank en
            je favoriete AI erbij.
          </p>
          <div className="site-cta">
            <Link href="/demo" className="button">
              Demo aanvragen
            </Link>
            <Link href="/prijzen" className="button tertiary">
              Prijzen
            </Link>
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <div className="site-section-head">
            <span className="site-eyebrow">Standaard</span>
            <h2>In elk abonnement, vanaf de eerste dag.</h2>
          </div>
          <ModuleGroups kind="standard" />
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <div className="site-section-head">
            <span className="site-eyebrow">Plug-ins</span>
            <h2>Zet aan wat je nodig hebt.</h2>
          </div>
          <ModuleGroups kind="plugin" />
        </div>
      </section>

      <section className="site-closing">
        <div className="site-container">
          <h2>Benieuwd hoe het samen werkt?</h2>
          <p>We laten je in een halfuur zien hoe Synbased werkt, met jouw manier van werken.</p>
          <Link href="/demo" className="button">
            Demo aanvragen
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
