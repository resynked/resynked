/** @type {import('next').NextConfig} */
const nextConfig = {
  // De browser waarmee de PDF gemaakt wordt hoort niet in de bundel: het is een
  // uitvoerbaar bestand van tientallen megabytes dat Next.js niet moet proberen
  // mee te compileren. Op de server wordt hij gewoon ingeladen.
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],

  // Oude adressen blijven werken: links in offerte- en factuurmails die al
  // verstuurd zijn, en de oude pagina met de voorwaarden
  async redirects() {
    return [
      { source: '/offerte/:token', destination: '/public/quotes/:token', permanent: true },
      { source: '/factuur/:token', destination: '/public/invoices/:token', permanent: true },
      { source: '/voorwaarden', destination: '/terms', permanent: true },
    ];
  },
};

export default nextConfig;
