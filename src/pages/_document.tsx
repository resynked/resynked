import { Html, Head, Main, NextScript } from 'next/document';

/**
 * Wat op elke pagina hetzelfde is. De titel staat hier bewust niet in: die
 * verschilt per pagina en wordt daar gezet.
 */
export default function Document() {
  return (
    <Html lang="nl">
      <Head>
        {/* Het logo uit de zijbalk doet ook dienst als tabbladpictogram */}
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <link rel="mask-icon" href="/logo.svg" color="#000000" />
        <meta name="theme-color" content="#000000" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
