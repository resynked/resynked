/** @type {import('next').NextConfig} */
const nextConfig = {
  // De browser waarmee de PDF gemaakt wordt hoort niet in de bundel: het is een
  // uitvoerbaar bestand van tientallen megabytes dat Next.js niet moet proberen
  // mee te compileren. Op de server wordt hij gewoon ingeladen.
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
};

export default nextConfig;
