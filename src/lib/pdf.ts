import type { Browser } from 'puppeteer-core';

/**
 * Maakt een PDF van een pagina uit de app zelf.
 *
 * De vormgeving zit in het sjabloon van de aannemer, in HTML en CSS. Een PDF
 * daarvan maken kan alleen een browser goed: die kent de @page-regels, de
 * pagina-einden per blok en de lettertypen. Vandaar een browser op de server in
 * plaats van een PDF-bibliotheek, die van het document een plaatje zou maken.
 *
 * Op Vercel draait een uitgeklede Chromium uit @sparticuz/chromium; lokaal de
 * Chrome die al op de machine staat, zodat er niets extra's gedownload hoeft.
 */

/** Chrome-installaties die lokaal gebruikt kunnen worden. */
const LOKALE_BROWSERS = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

async function startBrowser(): Promise<Browser> {
  const puppeteer = await import('puppeteer-core');

  // Op een server draait geen Chrome; daar komt hij uit het pakket
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import('@sparticuz/chromium')).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    }) as unknown as Browser;
  }

  const { existsSync } = await import('node:fs');
  const lokaal = LOKALE_BROWSERS.find((pad) => pad && existsSync(pad));

  if (!lokaal) {
    throw new Error(
      'Geen Chrome gevonden om de PDF mee te maken. Zet CHROME_PATH in .env.local.'
    );
  }

  return puppeteer.launch({
    executablePath: lokaal,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  }) as unknown as Browser;
}

interface PdfOptions {
  /** De pagina in de app die afgedrukt wordt */
  url: string;
  /** De sessie van de gebruiker, zodat de pagina zijn gegevens mag ophalen */
  cookie?: string;
}

export async function renderPdf({ url, cookie }: PdfOptions): Promise<Buffer> {
  const browser = await startBrowser();

  try {
    const page = await browser.newPage();
    if (cookie) await page.setExtraHTTPHeaders({ cookie });

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Het document wordt in stappen opgebouwd; wachten tot de blokken er staan
    await page.waitForSelector('[data-element]', { timeout: 20000 });

    // Een logo dat nog laadt zou als leeg vlak in de PDF komen
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map((img) => new Promise((klaar) => {
            img.addEventListener('load', klaar, { once: true });
            img.addEventListener('error', klaar, { once: true });
          }))
      );
      await (document as any).fonts?.ready;
    });

    // Pas als de lettertypes en plaatjes er zijn, staat vast hoeveel er op een
    // vel past. Het document verdeelt zichzelf dan over de vellen; daar moet
    // de PDF op wachten, anders valt hij midden in het opdelen
    await page.waitForSelector('[data-indeling="klaar"]', { timeout: 20000 }).catch(() => {
      // Een sjabloonloos document deelt niets op en meldt zich dus nooit klaar
    });

    // preferCSSPageSize houdt zich aan de @page-regel uit het eigen sjabloon
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
