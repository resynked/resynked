import { useEffect, useRef } from 'react';

/**
 * De inhoud van een mail, in een afgeschermd venstertje.
 *
 * Mail-HTML komt van buiten en mag niets in de app doen: scripts en formulieren
 * staan uit (sandbox zonder allow-scripts), en zijn opmaak blijft binnen het
 * venstertje in plaats van over onze pagina heen te lopen. Links openen in een
 * nieuw tabblad. Het venstertje groeit mee met de inhoud, ook als er later nog
 * plaatjes binnenkomen.
 */
export default function MailBody({ html }: { html: string }) {
  const frame = useRef<HTMLIFrameElement>(null);

  const document = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>
  body { margin: 0; font-family: Inter, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #000; overflow-wrap: anywhere; }
  img { max-width: 100%; height: auto; }
  blockquote { margin: 0 0 0 8px; padding-left: 10px; border-left: 2px solid #efefef; color: #7f7f7f; }
</style></head><body>${html}</body></html>`;

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;

    let observer: ResizeObserver | null = null;

    const fit = () => {
      const body = iframe.contentDocument?.body;
      if (!body) return;

      iframe.style.height = `${iframe.contentDocument!.documentElement.scrollHeight}px`;
      if (!observer) {
        observer = new ResizeObserver(() => {
          iframe.style.height = `${iframe.contentDocument?.documentElement.scrollHeight || 0}px`;
        });
        observer.observe(body);
      }
    };

    iframe.addEventListener('load', fit);
    return () => {
      iframe.removeEventListener('load', fit);
      observer?.disconnect();
    };
  }, [html]);

  return (
    <iframe
      ref={frame}
      className="mail-body"
      title="Inhoud van de mail"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={document}
    />
  );
}
