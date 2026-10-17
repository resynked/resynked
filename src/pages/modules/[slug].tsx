import Image from 'next/image';
import Link from 'next/link';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { ArrowLeft, Check } from 'lucide-react';
import SiteLayout from '@/components/site/SiteLayout';
import { MODULES, ModuleCell, findModule } from '@/components/site/modules';

/**
 * De pagina van één module op synbased.com: wat hij doet, hoe het werkt en
 * waar hij mee samenwerkt. Vooraf gebouwd voor elke module in MODULES.
 */
export default function ModulePage({ slug }: { slug: string }) {
  const module = findModule(slug)!;
  const Icon = module.icon;
  const related = module.related.map(findModule).filter((m): m is NonNullable<typeof m> => !!m);

  return (
    <SiteLayout title={module.name} description={module.summary}>
      <section className="site-section">
        <div className="site-container">
          <Link href="/modules" className="site-pill">
            <ArrowLeft size={13} /> Alle modules
          </Link>

          <div className="site-split site-module-head">
            <div>
              <span className="site-eyebrow">
                {module.kind === 'plugin' ? 'Plug-in' : 'Standaard'} · {module.group}
              </span>
              <h1>{module.name}</h1>
              <p className="site-lead">{module.lead}</p>
              <div className="site-cta">
                <Link href="/demo" className="button">
                  Demo aanvragen
                </Link>
                <Link href="/pricing" className="button tertiary">
                  Prijzen
                </Link>
              </div>
            </div>

            <div className="site-card">
              <Icon size={28} />
              <dl className="site-facts">
                {module.facts.map(({ label, value }) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <ul className="site-checklist">
                {module.features.map(({ title }) => (
                  <li key={title}>
                    <Check size={16} />
                    {title}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {module.screenshot && (
            // Niet breder dan de afbeelding zelf, anders wordt een klein scherm wazig
            <div className="site-hero-visual" style={{ maxWidth: module.screenshot.width }}>
              <Image
                src={module.screenshot.src}
                alt={module.screenshot.alt}
                width={module.screenshot.width}
                height={module.screenshot.height}
                sizes="(max-width: 1120px) 100vw, 1080px"
                className="screenshot"
              />
            </div>
          )}
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <div className="site-section-head">
            <span className="site-eyebrow">Wat het doet</span>
            <h2>{module.summary}</h2>
          </div>
          <div className="site-grid">
            {module.features.map(({ title, text }) => (
              <div key={title} className="site-grid-cell">
                <Check size={20} />
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <div className="site-section-head">
            <span className="site-eyebrow">Zo werkt het</span>
            <h2>In drie stappen.</h2>
          </div>
          <div className="site-grid three">
            {module.steps.map(({ title, text }, index) => (
              <div key={title} className="site-grid-cell">
                <span className="site-step">{String(index + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="site-section">
          <div className="site-container">
            <div className="site-section-head">
              <span className="site-eyebrow">Werkt samen met</span>
              <h2>Meer uit Synbased.</h2>
            </div>
            <div className="site-grid three">
              {related.map((item) => (
                <ModuleCell key={item.slug} module={item} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="site-closing">
        <div className="site-container">
          <h2>{module.name} in actie zien?</h2>
          <p>We laten je in een halfuur zien hoe Synbased werkt, met jouw manier van werken.</p>
          <Link href="/demo" className="button">
            Demo aanvragen
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: MODULES.map(module => ({ params: { slug: module.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps = async ({ params }) => ({
  props: { slug: String(params?.slug) },
});
