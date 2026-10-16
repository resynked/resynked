import { useEffect } from 'react';

/**
 * Pas afdrukken als het document er echt staat. Voor de afdrukpagina's van
 * offertes en facturen.
 *
 * Het sjabloon wordt in stappen opgebouwd: eerst opschonen, dan in de DOM
 * zetten, en daarna pas gaat de inhoud in de plekken met data-slot. Een vaste
 * wachttijd is daarvoor te wankel — dan krijg je een lege of halve pagina op
 * papier. Daarom wordt er gekeken of de inhoud er werkelijk is, en of de
 * afbeeldingen en lettertypen binnen zijn.
 *
 * Met enabled = false gebeurt er niets, bijvoorbeeld zolang het document nog
 * laadt, of als de server de pagina ophaalt om er zelf een PDF van te maken.
 */
export function usePrintWhenReady(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let gestopt = false;

    const isKlaar = () => {
      const vel = document.querySelector('.print-page');
      if (!vel) return false;

      // De blokken staan er pas als hun elementen er staan
      if (!vel.querySelector('[data-element]')) return false;

      // Een logo of QR-code die nog laadt zou als leeg vlak op papier komen
      const afbeeldingen = Array.from(vel.querySelectorAll('img'));
      return afbeeldingen.every((img) => img.complete);
    };

    const afdrukken = async () => {
      try {
        await document.fonts?.ready;
      } catch {
        // Kent de browser dit niet, dan drukken we zonder die zekerheid af
      }
      if (!gestopt) window.print();
    };

    // Elke tiende seconde kijken, en na acht seconden hoe dan ook afdrukken
    const begin = Date.now();
    const klok = setInterval(() => {
      if (gestopt) return;
      if (isKlaar() || Date.now() - begin > 8000) {
        clearInterval(klok);
        afdrukken();
      }
    }, 100);

    return () => {
      gestopt = true;
      clearInterval(klok);
    };
  }, [enabled]);
}
