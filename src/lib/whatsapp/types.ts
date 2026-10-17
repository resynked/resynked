/** Wat de rest van de app van een koppeling mag weten. */
export interface WhatsAppAccountInfo {
  /** Het eigen mobiele nummer van de gebruiker, leesbaar opgemaakt */
  phone: string;
}

/**
 * De bot van Synbased: één nummer voor iedereen, ingesteld in de
 * omgevingsvariabelen. De gebruiker ziet hem bij Plug-ins, maar kan hem niet
 * wijzigen.
 */
export interface WhatsAppConfig {
  configured: boolean;
  /** Het nummer van de bot, om in je telefoon op te slaan */
  botNumber: string | null;
  /** Begin en eind van de toegangstoken, zodat je ziet dat hij er staat */
  tokenHint: string | null;
}
