/** Een koppeling die nog wacht op de code vanaf de telefoon. */
export interface WhatsAppLinking {
  code: string;
  /** Het bericht dat de gebruiker naar de bot stuurt, zoals "Koppel ABC123" */
  message: string;
  /** Opent WhatsApp met dat bericht al klaar */
  link: string;
  expiresAt: string;
}

/** Wat de rest van de app van een koppeling mag weten. */
export interface WhatsAppAccountInfo {
  /** Het gekoppelde nummer, leesbaar opgemaakt; null zolang de code nog niet binnen is */
  phone: string | null;
  linking: WhatsAppLinking | null;
}

/** Of de bot voor Resynked is ingesteld, en op welk nummer. */
export interface WhatsAppConfig {
  configured: boolean;
  botNumber: string | null;
}
