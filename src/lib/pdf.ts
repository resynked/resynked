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

/**
 * Het adres waarop de gebruiker de download startte, zoals https://khance.com.
 * De PDF-browser moet precies daar de pagina ophalen: de sessiecookie hoort
 * bij dat adres. Met APP_URL ging het mis zodra die ook maar iets anders was
 * (met of zonder www), en dan kwam de PDF-browser uit op het inloggen.
 */
export function requestOrigin(req: { headers: Record<string, string | string[] | undefined> }): string {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.split(',')[0].trim();
  const host = first(req.headers['x-forwarded-host']) || first(req.headers.host);
  if (!host) throw new Error('Onbekend adres voor de PDF');
  const proto = first(req.headers['x-forwarded-proto']) || (host.startsWith('localhost') ? 'http' : 'https');

  // Alleen het eigen domein, met of zonder www: de server mag niet zomaar
  // een ander adres gaan openen dat iemand in de aanvraag zet
  const own = new URL(process.env.APP_URL || process.env.NEXTAUTH_URL || `${proto}://${host}`).hostname.replace(/^www\./, '');
  const asked = host.split(':')[0].replace(/^www\./, '');
  if (asked !== own && asked !== 'localhost') throw new Error('Onbekend adres voor de PDF');

  return `${proto}://${host}`;
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

    // De sessie van de gebruiker als echte cookies in deze browser. Als losse
    // Cookie-header laten nieuwere Chrome-versies hem soms vallen, en dan komt
    // de pagina uit op het inloggen in plaats van op het document
    if (cookie) {
      const { hostname, protocol } = new URL(url);
      const cookies = cookie
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const at = part.indexOf('=');
          return {
            name: part.slice(0, at),
            value: part.slice(at + 1),
            domain: hostname,
            path: '/',
            secure: protocol === 'https:',
            httpOnly: true,
          };
        })
        // __Host-cookies mogen geen domein hebben; dat is alleen het CSRF-token,
        // en dat is voor het ophalen van een pagina niet nodig
        .filter((c) => c.name && !c.name.startsWith('__Host-'));
      await browser.setCookie(...cookies);
    }

    // Fouten op de pagina bewaren: lukt het niet, dan staat er wát er misging
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(String((error as Error)?.message || error)));

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Doorgestuurd naar het inloggen: de sessie kwam niet mee
    if (!page.url().includes(new URL(url).pathname)) {
      throw new Error(`De PDF-pagina stuurde door naar ${new URL(page.url()).pathname}; de sessie kwam niet mee`);
    }

    // Het document wordt in stappen opgebouwd; wachten tot de blokken er staan,
    // of tot de pagina zegt dat het niet lukt
    try {
      await page.waitForSelector('[data-element], .empty-state', { timeout: 15000 });
    } catch {
      throw new Error(
        `Het document verscheen niet op de PDF-pagina${pageErrors.length ? `: ${pageErrors.join('; ')}` : ''}`
      );
    }
    const melding = await page.$eval('.empty-state', (el) => el.textContent?.trim() || '').catch(() => '');
    if (melding) throw new Error(`De PDF-pagina meldt: ${melding}`);

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
