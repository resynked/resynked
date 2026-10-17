/**
 * De uitleg achter het vraagteken naast de titel van elke pagina in de app
 * (zie HelpButton). Per module: wat het is, hoe je het gebruikt, en wat goed
 * is om te weten. Kort en in gewone taal; geen handleiding.
 */

export interface HelpTopic {
  title: string;
  /** Een of twee alinea's bovenaan */
  intro: string[];
  sections: { title: string; items: string[] }[];
}

export const HELP: Record<string, HelpTopic> = {
  dashboard: {
    title: 'Over het dashboard',
    intro: ['Je startpagina: in één oogopslag wat er openstaat, wat te laat is en wat je verdient.'],
    sections: [
      {
        title: 'Wat je ziet',
        items: [
          'Te ontvangen: verstuurde facturen die nog niet betaald zijn.',
          'Verlopen: facturen over de vervaldatum. Die wil je bellen of laten herinneren.',
          'Openstaande offertes en hoeveel procent er wordt goedgekeurd.',
          'Omzet: gerealiseerd (betaald, op de betaaldatum) en ongerealiseerd (verstuurd, nog niet betaald).',
        ],
      },
      {
        title: 'Tips',
        items: [
          'Kies rechtsboven in de grafiek een andere periode.',
          'Klik op een offerte of factuur in de lijsten om hem te openen.',
        ],
      },
    ],
  },
  inbox: {
    title: 'Over de inbox',
    intro: ['Je eigen Gmail of Outlook in Synbased. De mail blijft bij Google of Microsoft; Synbased haalt hem elke keer op.'],
    sections: [
      {
        title: 'Wat je kunt',
        items: [
          'Lezen, beantwoorden, doorsturen, archiveren en verwijderen, zoals je gewend bent.',
          'Met een AI-plug-in: een aanvraag met één klik omzetten naar een conceptofferte.',
        ],
      },
      {
        title: 'Goed om te weten',
        items: [
          'Koppelen of ontkoppelen doe je bij Instellingen > Plug-ins.',
          'Offertes en facturen die je verstuurt, staan ook in je Verzonden.',
        ],
      },
    ],
  },
  calendar: {
    title: 'Over de agenda',
    intro: ['De agenda van je gekoppelde Google- of Microsoft-account, in Synbased.'],
    sections: [
      {
        title: 'Wat je kunt',
        items: ['Je afspraken per dag, week of maand bekijken.', 'Een afspraak maken of aanpassen; hij staat meteen ook in je eigen agenda.'],
      },
    ],
  },
  customers: {
    title: 'Over klanten',
    intro: ['Al je klanten op één plek, particulier of zakelijk, met hun offertes en notities erbij.'],
    sections: [
      {
        title: 'Wat je bijhoudt',
        items: [
          'Naam, adres, e-mail en telefoon; bij een bedrijf ook KvK en btw-nummer.',
          'Een eigen klantnummer, dat ook in de keuzelijsten staat.',
          'Onder de tabbladen: de offertes en notities van deze klant.',
        ],
      },
      {
        title: 'Tips',
        items: [
          'Het e-mailadres is nodig om offertes en facturen te versturen.',
          'Met het IBAN van de klant koppelt Bank zijn betalingen vaker vanzelf aan de factuur.',
        ],
      },
    ],
  },
  quotes: {
    title: 'Over offertes',
    intro: [
      'Maak een offerte, verstuur hem en laat je klant online tekenen. Getekend? Dan zet je hem met één knop om naar een factuur.',
    ],
    sections: [
      {
        title: 'Zo werkt het',
        items: [
          'Een offerte bestaat uit pagina’s met elementen: tekst, een kop, een prijstabel of een handtekening.',
          'Elke prijstabel heeft een eigen btw-tarief, zodat 9% en 21% naast elkaar kunnen.',
          'Typ in een regel een omschrijving en kies een van je Producten; de prijs staat er meteen.',
          'Versturen gaat via je eigen Gmail of Outlook, met een knop naar de offerte om te tekenen.',
        ],
      },
      {
        title: 'Goed om te weten',
        items: [
          'Je ziet wanneer en hoe vaak de klant de offerte opende.',
          'Bij Instellingen > Offertes stel je een herinnering in voor offertes die nog niet getekend zijn.',
          'Een offerte mag je gewoon verwijderen; was het de laatste, dan krijgt de volgende hetzelfde nummer.',
        ],
      },
    ],
  },
  invoices: {
    title: 'Over facturen',
    intro: [
      'Verstuur facturen met de betaalgegevens en een QR-code voor de bank-app. De nummering loopt altijd door, zoals de Belastingdienst wil.',
    ],
    sections: [
      {
        title: 'Zo werkt het',
        items: [
          'Een nieuwe factuur is een concept zonder nummer. Hij krijgt zijn nummer pas bij versturen, markeren als verzonden of markeren als betaald.',
          'Daarna ligt hij vast en kun je hem niet meer wijzigen of verwijderen.',
          'Een fout herstel je met een creditfactuur: die draait de factuur (of een deel ervan) terug.',
          'Verstuur je hem zelf als PDF? Markeer hem dan eerst als verzonden en download hem daarna, zodat het nummer erop staat.',
        ],
      },
      {
        title: 'Betaald krijgen',
        items: [
          'Je klant scant de QR-code, of betaalt met iDEAL als Mollie aan staat.',
          'Met Bank of de bankkoppeling gaat een factuur vanzelf op betaald zodra het geld binnen is.',
          'Bij Instellingen > Facturen zet je betalingsherinneringen aan voor facturen over de vervaldatum.',
        ],
      },
    ],
  },
  expenses: {
    title: 'Over kosten',
    intro: [
      'Je bonnetjes en inkoopfacturen, met de btw die je terugkrijgt. Het bestand blijft veilig bewaard; de Belastingdienst vraagt zeven jaar.',
    ],
    sections: [
      {
        title: 'Zo werkt het',
        items: [
          'Upload een foto of PDF. Met een AI-plug-in worden leverancier, datum, bedragen en btw vanzelf ingevuld; controleer ze voor je opslaat.',
          'Vul per btw-tarief het bedrag exclusief btw in, zoals onderaan de bon. De btw rekent zichzelf uit en is aan te passen.',
          'De categorie bepaalt waar de kosten in je jaarcijfers komen.',
        ],
      },
      {
        title: 'Goed om te weten',
        items: [
          'Bij eten, drinken en relatiegeschenken krijg je de btw niet terug; die telt als kosten.',
          'Betaal je een inkoopfactuur via de bank, dan zet Bank hem vaak vanzelf op betaald.',
          'Verwijder alleen wat er per ongeluk in staat.',
        ],
      },
    ],
  },
  bank: {
    title: 'Over de bank',
    intro: [
      'De transacties van je zakelijke rekening. Betalingen van klanten en aan leveranciers worden waar het zeker is vanzelf gekoppeld; zo kloppen je jaarcijfers.',
    ],
    sections: [
      {
        title: 'Transacties binnenhalen',
        items: [
          'Download in je bank-app een afschrift als CAMT.053 (XML) of MT940 en kies Afschrift importeren.',
          'Of zet de bankkoppeling aan bij Instellingen > Plug-ins; dan komen ze elke ochtend vanzelf binnen.',
          'Gebruik voor één rekening het een of het ander, anders kunnen transacties dubbel binnenkomen.',
        ],
      },
      {
        title: 'Verwerken',
        items: [
          'Vanzelf gekoppeld: hetzelfde bedrag én het factuurnummer in de omschrijving (of het IBAN van de klant).',
          'De rest staat op Te verwerken. Kies Koppelen en wijs een factuur, kostenpost of categorie aan, zoals privé of bankkosten.',
          'Een Mollie-uitbetaling deel je in als Overboeking; de facturen zelf staan al op betaald.',
          'Ontkoppel je een transactie, dan gaat de factuur of kostenpost weer terug naar open.',
        ],
      },
    ],
  },
  vat: {
    title: 'Over het btw-overzicht',
    intro: [
      'Je btw-aangifte per kwartaal of jaar, rubriek voor rubriek zoals in Mijn Belastingdienst Zakelijk, met wat je betaalt of terugkrijgt.',
    ],
    sections: [
      {
        title: 'Wat er meetelt',
        items: [
          'Omzet op factuurdatum: verstuurde en betaalde facturen, creditfacturen als min-bedrag. Concepten niet.',
          'Voorbelasting (5b): de btw op je kosten, op de datum van de bon. Niet bij eten en drinken.',
          'De Belastingdienst rondt af op hele euro’s; neem de bedragen zo over.',
        ],
      },
      {
        title: 'Goed om te weten',
        items: [
          'Standaard staat het vorige kwartaal open: daar doe je nu aangifte over.',
          'Exporteren geeft een CSV met alle facturen en kosten van de periode, voor je boekhouder.',
          'Bij btw verlegd of leveringen naar of uit het buitenland: laat het nakijken door je boekhouder.',
        ],
      },
    ],
  },
  reports: {
    title: 'Over de jaarcijfers',
    intro: [
      'Je winst-en-verliesrekening en balans per jaar. Synbased houdt onder water een complete boekhouding bij uit je facturen, kosten en bank; je hoeft zelf niets te boeken.',
    ],
    sections: [
      {
        title: 'Wat je ziet',
        items: [
          'Omzet per btw-tarief en kosten per categorie, met je winst of verlies.',
          'De balans op 31 december: bank, debiteuren (nog te ontvangen), crediteuren (nog te betalen), btw en eigen vermogen.',
          'Grootboek exporteren geeft elke boeking van dat jaar, voor je boekhouder.',
        ],
      },
      {
        title: 'Zo kloppen ze',
        items: [
          'Verwerk eerst alles bij Bank: een transactie op Te verwerken staat apart op de balans.',
          'Zet betaalde facturen en kosten op betaald; dan staan debiteuren en crediteuren goed.',
          'Afschrijvingen, voorraad en fiscale regelingen zoals de zelfstandigenaftrek zitten er niet in. Dit is geen officiële jaarrekening.',
        ],
      },
    ],
  },
  products: {
    title: 'Over producten',
    intro: ['Je vaste prijzen voor werk en materiaal, zoals uurloon of m² tegelwerk.'],
    sections: [
      {
        title: 'Zo werkt het',
        items: [
          'Zet een product één keer neer met prijs (exclusief btw) en eenheid.',
          'Typ in een prijstabel een omschrijving en kies het product; de prijs staat er meteen.',
          'De regel krijgt een kopie: een nieuwe prijs verandert geen offertes die je al maakte.',
        ],
      },
    ],
  },
  notes: {
    title: 'Over notities',
    intro: ['Maten, afspraken en details per klant, opgemaakt en terug te vinden.'],
    sections: [
      {
        title: 'Zo werkt het',
        items: [
          'Een notitie hoort bij een klant en staat ook bij die klant, onder Notities.',
          'Gebruik koppen, lijstjes en vet om het overzichtelijk te houden.',
          'Zoek op titel, tekst of klantnaam.',
        ],
      },
    ],
  },
  settings: {
    title: 'Over instellingen',
    intro: ['Hier richt je Synbased in voor je bedrijf: je gegevens, je opmaak, je mails en je koppelingen.'],
    sections: [
      {
        title: 'De tabbladen',
        items: [
          'Account: je naam en je bedrijfsgegevens, zoals logo, IBAN, KvK en btw-nummer; die komen op elke offerte en factuur.',
          'Privacy: je wachtwoord en tweestapsverificatie.',
          'Plug-ins: Gmail of Outlook, WhatsApp, AI, Mollie en de bankkoppeling aan- of uitzetten.',
          'Offertes en Facturen: nummering, opmaak, de mail en de herinneringen.',
        ],
      },
    ],
  },
};
