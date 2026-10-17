import type { ReactElement } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ChartColumn,
  FilePen,
  FileSignature,
  Landmark,
  LayoutDashboard,
  Package,
  Percent,
  Receipt,
  ReceiptEuro,
  Sparkles,
  Users,
  Bird,
  type LucideIcon,
} from 'lucide-react';
import { GoogleIcon, MicrosoftIcon, MollieIcon, WhatsAppIcon } from '@/components/BrandIcons';

/**
 * De modules van Synbased voor de website: wat er standaard in zit en welke
 * plug-ins je erbij aanzet. Eén lijst voor het overzicht op /modules en de
 * detailpagina's op /modules/[slug].
 *
 * Alleen wat Synbased echt kan; komt er een module bij, zet hem dan hier.
 * ModuleCell onderaan is het blok in het raster, op beide pagina's.
 */

export interface SiteModule {
  slug: string;
  name: string;
  /** Standaard in het abonnement, of een plug-in die je bij Instellingen aanzet */
  kind: 'standard' | 'plugin';
  /** Waar hij in het overzicht onder staat */
  group: string;
  icon: LucideIcon | ((props: { size?: number }) => ReactElement);
  /** Eén regel voor het blok in het overzicht */
  summary: string;
  /** Twee of drie zinnen bovenaan de detailpagina */
  lead: string;
  features: { title: string; text: string }[];
  steps: { title: string; text: string }[];
  /** Feitjes in de kaart naast de kop */
  facts: { label: string; value: string }[];
  /** Een schermafbeelding uit public/screens, als die er is */
  screenshot?: { src: string; alt: string; width: number; height: number };
  related: string[];
}

export const MODULE_GROUPS = ['Verkoop', 'Financiën', 'Overzicht', 'E-mail en agenda', 'Berichten en AI', 'Betalen en bank'];

export const MODULES: SiteModule[] = [
  {
    slug: 'offertes',
    name: 'Offertes',
    kind: 'standard',
    group: 'Verkoop',
    icon: FileSignature,
    summary: 'Offertes in je eigen huisstijl, online laten tekenen en vanzelf opvolgen.',
    lead: 'Maak een offerte met je vaste producten, verstuur hem met één klik en laat je klant online tekenen met vinger of muis. Je ziet wanneer hij hem opent, en Synbased stuurt zelf een herinnering als het even duurt.',
    features: [
      { title: 'Online ondertekenen', text: 'Je klant opent de offerte via een knop in de mail en tekent direct. De handtekening staat op de offerte.' },
      { title: 'Geopend door de klant', text: 'Je ziet wanneer en hoe vaak de offerte bekeken is, zodat je weet wanneer je kunt bellen.' },
      { title: 'Vanzelf een herinnering', text: 'Nog niet getekend na het aantal dagen dat jij kiest? Dan gaat er één vriendelijke herinnering.' },
      { title: 'Eigen opmaak', text: 'Je logo, je kleuren en desnoods je eigen sjabloon, staand of liggend A4, met meerdere btw-tarieven.' },
    ],
    steps: [
      { title: 'Maak de offerte', text: 'Zelf, vanuit een mail met AI, of met een WhatsApp-bericht vanaf de bouwplaats.' },
      { title: 'Verstuur en laat tekenen', text: 'Vanuit je eigen Gmail of Outlook, met een knop naar de offerte.' },
      { title: 'Zet om naar een factuur', text: 'Getekend? Met één knop wordt het een factuur, met alle regels erin.' },
    ],
    facts: [
      { label: 'Soort', value: 'Standaard' },
      { label: 'Kosten', value: 'Inbegrepen' },
      { label: 'Werkt met', value: 'Facturen, Producten, Klanten' },
    ],
    screenshot: { src: '/screens/quote.webp', alt: 'Een ondertekende offerte zoals de klant hem ziet', width: 818, height: 800 },
    related: ['facturen', 'producten', 'ai'],
  },
  {
    slug: 'facturen',
    name: 'Facturen',
    kind: 'standard',
    group: 'Verkoop',
    icon: ReceiptEuro,
    summary: 'Facturen met QR-code, doorlopende nummers, creditfacturen en betalingsherinneringen.',
    lead: 'Verstuur een factuur met de betaalgegevens en een QR-code voor de bank-app. De nummering loopt altijd door zoals de Belastingdienst wil, een verstuurde factuur ligt vast, en wie te laat is krijgt vanzelf een herinnering.',
    features: [
      { title: 'QR-code voor de bank-app', text: 'Je klant scant en betaalt; bedrag, IBAN en omschrijving staan er al in.' },
      { title: 'Volgens de regels', text: 'Een nummer pas bij versturen, dus nooit een gat in de reeks. Corrigeren gaat met een creditfactuur.' },
      { title: 'Betalingsherinneringen', text: 'Over de vervaldatum? Na het aantal dagen dat jij kiest een herinnering, en daarna nog één.' },
      { title: 'Eigen nummering', text: 'Met een jaartal, letters of gewoon doorlopend; het systeem telt zelf verder.' },
    ],
    steps: [
      { title: 'Maak de factuur', text: 'Vanuit een getekende offerte of los, met je vaste producten.' },
      { title: 'Verstuur hem', text: 'De factuur krijgt zijn nummer en gaat met betaalgegevens en QR-code naar je klant.' },
      { title: 'Krijg betaald', text: 'Via de bank-app of iDEAL; met de bankkoppeling staat hij vanzelf op betaald.' },
    ],
    facts: [
      { label: 'Soort', value: 'Standaard' },
      { label: 'Kosten', value: 'Inbegrepen' },
      { label: 'Werkt met', value: 'Offertes, Mollie, Bank' },
    ],
    screenshot: { src: '/screens/payment.webp', alt: 'Het betaalblok op een factuur met een QR-code voor de bank-app', width: 600, height: 270 },
    related: ['offertes', 'mollie', 'bank'],
  },
  {
    slug: 'klanten',
    name: 'Klanten',
    kind: 'standard',
    group: 'Verkoop',
    icon: Users,
    summary: 'Alle gegevens van je klanten, met hun offertes en notities bij elkaar.',
    lead: 'Particulier of bedrijf: naam, adres, KvK, btw-nummer en IBAN op één plek. Bij elke klant zie je zijn offertes en notities, zodat je weet wat je hebt afgesproken.',
    features: [
      { title: 'Particulier en zakelijk', text: 'Met contactgegevens, adres, KvK, btw-nummer en IBAN.' },
      { title: 'Alles bij de klant', text: 'Zijn offertes en notities onder tabbladen, met één klik te openen.' },
      { title: 'Klantnummers', text: 'Een eigen klantnummer per klant, ook in de keuzelijsten.' },
      { title: 'Snel gevonden', text: 'Zoeken op naam, bedrijf of e-mailadres.' },
    ],
    steps: [
      { title: 'Voeg de klant toe', text: 'Met de hand, of vanzelf uit een mail of WhatsApp-bericht met AI.' },
      { title: 'Maak een offerte', text: 'Kies de klant; zijn gegevens staan meteen op de offerte.' },
      { title: 'Houd bij wat er speelt', text: 'Notities, offertes en facturen bij elkaar.' },
    ],
    facts: [
      { label: 'Soort', value: 'Standaard' },
      { label: 'Kosten', value: 'Inbegrepen' },
      { label: 'Werkt met', value: 'Offertes, Notities' },
    ],
    related: ['notities', 'offertes', 'ai'],
  },
  {
    slug: 'producten',
    name: 'Producten',
    kind: 'standard',
    group: 'Verkoop',
    icon: Package,
    summary: 'Je vaste prijzen voor werk en materiaal, te kiezen terwijl je typt.',
    lead: 'Uurloon, m² tegelwerk, voorrijkosten: zet ze één keer neer met prijs en eenheid. In de offerte komen ze als suggestie terwijl je typt, en een latere prijswijziging verandert geen oude offertes.',
    features: [
      { title: 'Prijs en eenheid', text: 'Per stuk, uur, m², m³ of post, exclusief btw.' },
      { title: 'Suggesties tijdens het typen', text: 'Typ een omschrijving en kies het product; de prijs staat er meteen.' },
      { title: 'Oude offertes blijven gelijk', text: 'Een regel krijgt een kopie, dus een nieuwe prijs geldt alleen voor nieuw werk.' },
      { title: 'Ook voor de AI', text: 'De AI gebruikt je eerdere prijzen bij een voorstel uit een mail.' },
    ],
    steps: [
      { title: 'Zet je prijzen neer', text: 'Eén keer, bij Producten.' },
      { title: 'Kies ze in de offerte', text: 'Typ en kies; aantal erbij en klaar.' },
      { title: 'Pas aan wanneer je wilt', text: 'Nieuwe prijzen gelden vanaf de volgende offerte.' },
    ],
    facts: [
      { label: 'Soort', value: 'Standaard' },
      { label: 'Kosten', value: 'Inbegrepen' },
      { label: 'Werkt met', value: 'Offertes, Facturen' },
    ],
    related: ['offertes', 'facturen', 'ai'],
  },
  {
    slug: 'kosten',
    name: 'Kosten',
    kind: 'standard',
    group: 'Financiën',
    icon: Receipt,
    summary: 'Bonnetjes en inkoopfacturen bewaren; met AI vanzelf ingevuld.',
    lead: 'Maak een foto van je bon of upload de inkoopfactuur. Met een AI-plug-in staan leverancier, datum, bedragen en btw er vanzelf in. Het bestand blijft zeven jaar veilig bewaard, zoals de bewaarplicht vraagt.',
    features: [
      { title: 'Foto of PDF', text: 'Van de bouwmarkt, de groothandel of een abonnement; alles op één plek.' },
      { title: 'Vanzelf ingevuld', text: 'Met een AI-plug-in leest Synbased de bon uit; jij controleert en slaat op.' },
      { title: 'Btw per tarief', text: 'Regels per tarief, zoals onderaan de bon. Btw op eten en drinken telt niet als voorbelasting.' },
      { title: 'Veilig bewaard', text: 'Afgeschermd opgeslagen; alleen jij komt erbij.' },
    ],
    steps: [
      { title: 'Upload de bon', text: 'Een foto met je telefoon of de PDF uit je mail.' },
      { title: 'Controleer', text: 'Leverancier, categorie en bedragen staan er al; pas aan wat nodig is.' },
      { title: 'Klaar voor de aangifte', text: 'De btw telt mee als voorbelasting in je btw-aangifte.' },
    ],
    facts: [
      { label: 'Soort', value: 'Standaard' },
      { label: 'Kosten', value: 'Inbegrepen; AI met je eigen sleutel' },
      { label: 'Werkt met', value: 'Btw-aangifte, Bank, AI' },
    ],
    related: ['btw-aangifte', 'bank', 'ai'],
  },
  {
    slug: 'bank',
    name: 'Bank',
    kind: 'standard',
    group: 'Financiën',
    icon: Landmark,
    summary: 'Je bankafschrift inlezen; betalingen worden vanzelf aan facturen gekoppeld.',
    lead: 'Importeer een afschrift uit je bank-app. Betaalt een klant, dan staat zijn factuur vanzelf op betaald; betaal jij een leverancier, dan de kostenpost. Wat overblijft deel je in, zoals privé of bankkosten.',
    features: [
      { title: 'Elke Nederlandse bank', text: 'CAMT.053 of MT940, zoals ING, Rabobank, ABN AMRO, bunq en Knab ze leveren.' },
      { title: 'Vanzelf gekoppeld', text: 'Alleen als het zeker is: hetzelfde bedrag en het factuurnummer in de omschrijving.' },
      { title: 'Te verwerken', text: 'De rest koppel je met één keuze aan een factuur, kostenpost of categorie.' },
      { title: 'Saldo per rekening', text: 'Altijd zien wat er staat, voor elke zakelijke rekening.' },
    ],
    steps: [
      { title: 'Download een afschrift', text: 'In je bank-app of internetbankieren.' },
      { title: 'Importeer het', text: 'Dubbele transacties worden overgeslagen.' },
      { title: 'Verwerk wat overblijft', text: 'Koppelen of indelen, zodat je jaarcijfers kloppen.' },
    ],
    facts: [
      { label: 'Soort', value: 'Standaard' },
      { label: 'Kosten', value: 'Inbegrepen' },
      { label: 'Werkt met', value: 'Facturen, Kosten, Bankkoppeling' },
    ],
    related: ['bankkoppeling', 'facturen', 'jaarcijfers'],
  },
  {
    slug: 'btw-aangifte',
    name: 'Btw-aangifte',
    kind: 'standard',
    group: 'Financiën',
    icon: Percent,
    summary: 'Je btw-aangifte per kwartaal, rubriek voor rubriek klaar om over te nemen.',
    lead: 'Synbased rekent je aangifte uit zoals in Mijn Belastingdienst Zakelijk: omzet en btw per tarief, de voorbelasting uit je kosten, en wat je betaalt of terugkrijgt. Met een export voor je boekhouder.',
    features: [
      { title: 'Rubriek voor rubriek', text: '1a, 1b, 1c en 1e, 5a en 5b, en het bedrag om te betalen of terug te vragen.' },
      { title: 'Op factuurdatum', text: 'Zoals de aangifte werkt; creditfacturen tellen als min-bedrag.' },
      { title: 'Met voorbelasting', text: 'De btw op je kosten gaat er vanzelf af.' },
      { title: 'Export voor de boekhouder', text: 'Alle facturen en kosten van het kwartaal in één CSV.' },
    ],
    steps: [
      { title: 'Kies het kwartaal', text: 'Standaard het vorige: daar doe je nu aangifte over.' },
      { title: 'Controleer', text: 'Daaronder staan de facturen en kosten waar het uit komt.' },
      { title: 'Neem het over', text: 'In Mijn Belastingdienst Zakelijk, of stuur de export naar je boekhouder.' },
    ],
    facts: [
      { label: 'Soort', value: 'Standaard' },
      { label: 'Kosten', value: 'Inbegrepen' },
      { label: 'Werkt met', value: 'Facturen, Kosten' },
    ],
    related: ['kosten', 'jaarcijfers', 'facturen'],
  },
  {
    slug: 'jaarcijfers',
    name: 'Jaarcijfers',
    kind: 'standard',
    group: 'Financiën',
    icon: ChartColumn,
    summary: 'Winst-en-verlies en balans per jaar, zonder zelf te boekhouden.',
    lead: 'Synbased houdt onder water een complete boekhouding bij uit je facturen, kosten en bank. Je ziet je winst-en-verliesrekening en balans per jaar, en je boekhouder krijgt het grootboek als export.',
    features: [
      { title: 'Winst-en-verliesrekening', text: 'Omzet per tarief en kosten per categorie, met je winst.' },
      { title: 'Balans', text: 'Bank, debiteuren, crediteuren, btw en eigen vermogen op 31 december.' },
      { title: 'Altijd kloppend', text: 'Dubbel boekhouden onder water, afgeleid uit wat er al in Synbased staat.' },
      { title: 'Grootboek als export', text: 'Elke boeking met datum, rekening en bron, voor je boekhouder.' },
    ],
    steps: [
      { title: 'Werk gewoon door', text: 'Facturen, kosten en bank vullen de boekhouding vanzelf.' },
      { title: 'Kies het jaar', text: 'Winst-en-verlies en balans staan klaar.' },
      { title: 'Deel met je boekhouder', text: 'Exporteer het grootboek voor de jaarafsluiting.' },
    ],
    facts: [
      { label: 'Soort', value: 'Standaard' },
      { label: 'Kosten', value: 'Inbegrepen' },
      { label: 'Werkt met', value: 'Facturen, Kosten, Bank' },
    ],
    related: ['btw-aangifte', 'bank', 'kosten'],
  },
  {
    slug: 'dashboard',
    name: 'Dashboard',
    kind: 'standard',
    group: 'Overzicht',
    icon: LayoutDashboard,
    summary: 'In één oogopslag wat er openstaat, wat te laat is en wat je verdient.',
    lead: 'Te ontvangen, verlopen, openstaande offertes en hoeveel er wordt goedgekeurd. Daaronder je omzet per dag, maand of jaar, betaald en nog niet betaald.',
    features: [
      { title: 'Wat openstaat', text: 'Facturen die wachten op betaling en offertes die nog niet getekend zijn.' },
      { title: 'Wat te laat is', text: 'Facturen over de vervaldatum, zodat je weet wie je moet bellen.' },
      { title: 'Omzetgrafiek', text: 'Gerealiseerd en ongerealiseerd, per periode.' },
      { title: 'Snel aan de slag', text: 'Een offerte of factuur maken staat bovenaan.' },
    ],
    steps: [
      { title: 'Log in', text: 'Het dashboard is je startpagina.' },
      { title: 'Zie wat aandacht nodig heeft', text: 'Openstaand en verlopen bovenaan.' },
      { title: 'Klik door', text: 'Elke offerte en factuur is één klik verder.' },
    ],
    facts: [
      { label: 'Soort', value: 'Standaard' },
      { label: 'Kosten', value: 'Inbegrepen' },
      { label: 'Werkt met', value: 'Offertes, Facturen' },
    ],
    screenshot: { src: '/screens/dashboard.webp', alt: 'Het dashboard van Synbased met openstaande offertes, facturen en de omzet', width: 1680, height: 1070 },
    related: ['facturen', 'offertes', 'jaarcijfers'],
  },
  {
    slug: 'notities',
    name: 'Notities',
    kind: 'standard',
    group: 'Overzicht',
    icon: FilePen,
    summary: 'Maten, afspraken en details per klant, opgemaakt en terug te vinden.',
    lead: 'Schrijf op wat je bij de klant hebt opgemeten of afgesproken, met koppen en lijstjes. De notitie staat bij de klant, zodat je hem bij de offerte terugvindt.',
    features: [
      { title: 'Opgemaakte tekst', text: 'Koppen, lijstjes en vet, zoals je gewend bent.' },
      { title: 'Bij de klant', text: 'Onder het tabblad Notities van elke klant.' },
      { title: 'Zoeken', text: 'In titels, tekst en klantnamen.' },
      { title: 'Altijd bij de hand', text: 'Ook op je telefoon, in de browser.' },
    ],
    steps: [
      { title: 'Maak een notitie', text: 'Vanuit Notities of direct bij de klant.' },
      { title: 'Schrijf op wat telt', text: 'Maten, wensen, afspraken.' },
      { title: 'Vind hem terug', text: 'Bij de klant of via zoeken.' },
    ],
    facts: [
      { label: 'Soort', value: 'Standaard' },
      { label: 'Kosten', value: 'Inbegrepen' },
      { label: 'Werkt met', value: 'Klanten' },
    ],
    related: ['klanten', 'offertes', 'whatsapp'],
  },
  {
    slug: 'google',
    name: 'Gmail en Google Agenda',
    kind: 'plugin',
    group: 'E-mail en agenda',
    icon: GoogleIcon,
    summary: 'Je Gmail en agenda in Synbased; offertes en facturen vanaf je eigen adres.',
    lead: 'Koppel je Google-account en lees, beantwoord en plan zonder te wisselen tussen programma’s. Offertes en facturen gaan vanaf je eigen adres de deur uit en staan in je Verzonden.',
    features: [
      { title: 'Inbox in Synbased', text: 'Lezen, beantwoorden, doorsturen en archiveren.' },
      { title: 'Agenda', text: 'Je afspraken bekijken en nieuwe inplannen.' },
      { title: 'Vanaf je eigen adres', text: 'Offertes, facturen en herinneringen gaan via je eigen Gmail.' },
      { title: 'Niet bij ons bewaard', text: 'Je mail wordt elke keer bij Google opgehaald.' },
    ],
    steps: [
      { title: 'Zet de plug-in aan', text: 'Bij Instellingen > Plug-ins.' },
      { title: 'Log in bij Google', text: 'In een venster van Google zelf.' },
      { title: 'Klaar', text: 'Inbox en Agenda staan in het menu.' },
    ],
    facts: [
      { label: 'Soort', value: 'Plug-in' },
      { label: 'Kosten', value: 'Inbegrepen' },
      { label: 'Werkt met', value: 'Gmail, Google Agenda' },
    ],
    screenshot: { src: '/screens/inbox.webp', alt: 'De inbox in Synbased met een aanvraag die je omzet naar een offerte', width: 1200, height: 602 },
    related: ['microsoft', 'ai', 'offertes'],
  },
  {
    slug: 'microsoft',
    name: 'Outlook',
    kind: 'plugin',
    group: 'E-mail en agenda',
    icon: MicrosoftIcon,
    summary: 'Je Outlook-mail en -agenda in Synbased, voor Microsoft 365 en Outlook.com.',
    lead: 'Koppel je Microsoft-account en werk met je mail en agenda in Synbased. Voor een zakelijk Microsoft 365-account kan je IT-beheerder de koppeling in één keer goedkeuren voor het hele bedrijf.',
    features: [
      { title: 'Inbox in Synbased', text: 'Lezen, beantwoorden, doorsturen en archiveren.' },
      { title: 'Agenda', text: 'Je afspraken bekijken en nieuwe inplannen.' },
      { title: 'Vanaf je eigen adres', text: 'Offertes, facturen en herinneringen gaan via je eigen Outlook.' },
      { title: 'Goedkeuring door de beheerder', text: 'Met een link die je IT-beheerder één keer opent.' },
    ],
    steps: [
      { title: 'Zet de plug-in aan', text: 'Bij Instellingen > Plug-ins.' },
      { title: 'Log in bij Microsoft', text: 'In een venster van Microsoft zelf.' },
      { title: 'Klaar', text: 'Inbox en Agenda staan in het menu.' },
    ],
    facts: [
      { label: 'Soort', value: 'Plug-in' },
      { label: 'Kosten', value: 'Inbegrepen' },
      { label: 'Werkt met', value: 'Microsoft 365, Outlook.com' },
    ],
    screenshot: { src: '/screens/inbox.webp', alt: 'De inbox in Synbased met een aanvraag die je omzet naar een offerte', width: 1200, height: 602 },
    related: ['google', 'ai', 'offertes'],
  },
  {
    slug: 'whatsapp',
    name: 'WhatsApp',
    kind: 'plugin',
    group: 'Berichten en AI',
    icon: WhatsAppIcon,
    summary: 'Een offerte maken met één WhatsApp-bericht, vanaf de bouwplaats.',
    lead: 'Stuur de bot van Synbased een bericht met wat je ziet en meet, in steekwoorden. Als je thuis bent staat de conceptofferte klaar, met de klant en de regels erin.',
    features: [
      { title: 'In steekwoorden', text: '"Keuken 45m2 tegels eruit, vloerverwarming" is genoeg.' },
      { title: 'Klant erbij', text: 'Een bekende klant wordt herkend; een nieuwe wordt aangemaakt.' },
      { title: 'Met je eigen prijzen', text: 'De AI gebruikt de prijzen uit je eerdere offertes.' },
      { title: 'Altijd een concept', text: 'Je controleert de offerte voor hij naar de klant gaat.' },
    ],
    steps: [
      { title: 'Koppel je nummer', text: 'Bij Instellingen > Plug-ins, met je eigen mobiele nummer.' },
      { title: 'Stuur een bericht', text: 'Vanaf de bouwplaats aan de bot.' },
      { title: 'Controleer en verstuur', text: 'De offerte staat als concept in Synbased.' },
    ],
    facts: [
      { label: 'Soort', value: 'Plug-in' },
      { label: 'Kosten', value: 'Inbegrepen; AI met je eigen sleutel' },
      { label: 'Werkt met', value: 'Offertes, AI' },
    ],
    related: ['ai', 'offertes', 'klanten'],
  },
  {
    slug: 'ai',
    name: 'AI-assistent',
    kind: 'plugin',
    group: 'Berichten en AI',
    icon: Sparkles,
    summary: 'Van mail naar offerte, en bonnetjes vanzelf uitgelezen. Met Claude, OpenAI of Gemini.',
    lead: 'Koppel je eigen sleutel van Anthropic, OpenAI of Google Gemini. Een aanvraag in je inbox wordt met één klik een conceptofferte met prijzen uit je eerdere werk, en een foto van je bon vult je kostenpost vanzelf in.',
    features: [
      { title: 'Van mail naar offerte', text: 'Klant, regels en prijzen uit de mail, en een antwoord als er iets ontbreekt.' },
      { title: 'Bonnetjes lezen', text: 'Leverancier, datum, bedragen en btw van een foto of PDF.' },
      { title: 'Je eigen prijzen', text: 'Gebaseerd op wat je eerder rekende; nooit verzonnen.' },
      { title: 'Jouw keuze', text: 'Claude, OpenAI of Gemini; Gemini heeft een gratis laag om te proberen.' },
    ],
    steps: [
      { title: 'Kies je AI', text: 'Bij Instellingen > Plug-ins, met je eigen API-sleutel.' },
      { title: 'Gebruik hem', text: 'In de Inbox bij een aanvraag, of bij een nieuwe kostenpost.' },
      { title: 'Controleer', text: 'Het is altijd een voorstel; jij beslist.' },
    ],
    facts: [
      { label: 'Soort', value: 'Plug-in' },
      { label: 'Kosten', value: 'Per gebruik bij je AI-dienst' },
      { label: 'Werkt met', value: 'Anthropic, OpenAI, Google Gemini' },
    ],
    related: ['kosten', 'whatsapp', 'google'],
  },
  {
    slug: 'mollie',
    name: 'Mollie',
    kind: 'plugin',
    group: 'Betalen en bank',
    icon: MollieIcon,
    summary: 'Je klant betaalt direct met iDEAL; de factuur staat vanzelf op betaald.',
    lead: 'Met Mollie komt er een betaalknop op de factuurpagina van je klant. Hij betaalt in een paar tikken met iDEAL, en de factuur staat daarna vanzelf op betaald. Het geld gaat rechtstreeks naar je eigen rekening.',
    features: [
      { title: 'Nu betalen', text: 'Een betaalknop met iDEAL, Bancontact en meer.' },
      { title: 'Vanzelf op betaald', text: 'Met de juiste datum, zonder iets bij te houden.' },
      { title: 'Je eigen rekening', text: 'Synbased komt niet aan het geld.' },
      { title: 'Eerst proberen', text: 'Met een testsleutel wordt er niet echt betaald.' },
    ],
    steps: [
      { title: 'Maak een Mollie-account', text: 'Met je KvK-nummer en rekening, in een paar minuten.' },
      { title: 'Plak je sleutel', text: 'Bij Instellingen > Plug-ins.' },
      { title: 'Krijg sneller betaald', text: 'Elke factuur heeft de betaalknop.' },
    ],
    facts: [
      { label: 'Soort', value: 'Plug-in' },
      { label: 'Kosten', value: 'Per betaling bij Mollie, iDEAL rond € 0,30' },
      { label: 'Werkt met', value: 'Facturen' },
    ],
    related: ['facturen', 'bankkoppeling', 'bank'],
  },
  {
    slug: 'bankkoppeling',
    name: 'Bankkoppeling',
    kind: 'plugin',
    group: 'Betalen en bank',
    icon: Landmark,
    summary: 'Je transacties elke ochtend vanzelf binnen, zonder afschrift te downloaden.',
    lead: 'Geef bij je eigen bank toestemming en Synbased haalt elke ochtend je transacties op. Betalingen van klanten staan dan vanzelf bij hun factuur. Synbased kan alleen lezen: er kan nooit geld van je rekening af.',
    features: [
      { title: 'Elke ochtend opgehaald', text: 'En wanneer je wilt met "Nu ophalen".' },
      { title: 'Vanzelf gekoppeld', text: 'Een factuur staat op betaald zodra het geld binnen is.' },
      { title: 'Alleen lezen', text: 'Via PSD2 en GoCardless, onder vergunning.' },
      { title: '90 dagen toestemming', text: 'Daarna vraagt je bank het opnieuw; zo houd jij de regie.' },
    ],
    steps: [
      { title: 'Kies je bank', text: 'Bij Instellingen > Plug-ins.' },
      { title: 'Geef toestemming', text: 'Bij je eigen bank, met je eigen inlog.' },
      { title: 'Klaar', text: 'Je transacties staan bij Bank.' },
    ],
    facts: [
      { label: 'Soort', value: 'Plug-in' },
      { label: 'Kosten', value: 'Inbegrepen' },
      { label: 'Werkt met', value: 'Nederlandse banken via GoCardless' },
    ],
    related: ['bank', 'facturen', 'jaarcijfers'],
  },
  {
    slug: 'moneybird',
    name: 'Moneybird',
    kind: 'plugin',
    group: 'Betalen en bank',
    icon: Bird,
    summary: 'Werk je boekhouding nog in Moneybird? Dan gaan je facturen er vanzelf heen.',
    lead: 'Voor wie zijn boekhouding (nog) in Moneybird doet: elke verstuurde factuur en creditfactuur staat er meteen in, met de klant, de regels en de juiste btw. Zet je hem op betaald, dan gebeurt dat in Moneybird ook.',
    features: [
      { title: 'Facturen in de boekhouding', text: 'Als externe verkoopfactuur, met de juiste btw per regel.' },
      { title: 'Betalingen mee', text: 'Betaald in Synbased is betaald in Moneybird.' },
      { title: 'Bestaande facturen', text: 'Met één knop alsnog overzetten.' },
      { title: 'Niets dubbel', text: 'Wat er al staat, wordt overgeslagen.' },
    ],
    steps: [
      { title: 'Maak een API-token', text: 'In Moneybird bij Instellingen > Ontwikkelaars.' },
      { title: 'Plak het token', text: 'Bij Instellingen > Plug-ins, en kies je administratie.' },
      { title: 'Klaar', text: 'Nieuwe facturen gaan er vanzelf heen.' },
    ],
    facts: [
      { label: 'Soort', value: 'Plug-in' },
      { label: 'Kosten', value: 'Een Moneybird-abonnement' },
      { label: 'Werkt met', value: 'Facturen' },
    ],
    related: ['facturen', 'jaarcijfers', 'btw-aangifte'],
  },
];

export function findModule(slug: string): SiteModule | undefined {
  return MODULES.find(module => module.slug === slug);
}

/** Eén blok in het raster; een klik opent de detailpagina */
export function ModuleCell({ module }: { module: SiteModule }) {
  const Icon = module.icon;
  return (
    <Link href={`/modules/${module.slug}`} className="site-grid-cell">
      <Icon size={20} />
      <h3>{module.name}</h3>
      <p>{module.summary}</p>
      <span className="site-more">
        Meer over {module.name} <ArrowRight size={13} />
      </span>
    </Link>
  );
}
