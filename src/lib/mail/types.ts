/** De mailaanbieders waarmee een inbox gekoppeld kan worden. */
export type MailProviderName = 'google' | 'microsoft';

export const MAIL_PROVIDERS: MailProviderName[] = ['google', 'microsoft'];

/** Het kanaal waarover het popupvenster Instellingen laat weten hoe het koppelen ging. */
export const MAIL_CHANNEL = 'resynked-mail';

export interface MailAddress {
  name: string;
  email: string;
}

/** Eén regel in de lijst: een gesprek, met het laatste bericht erin. */
export interface MailSummary {
  id: string;
  subject: string;
  from: MailAddress;
  snippet: string;
  date: string;
  unread: boolean;
}

/** Eén bericht in een gesprek, met de inhoud. */
export interface MailMessage {
  id: string;
  from: MailAddress;
  to: MailAddress[];
  cc: MailAddress[];
  date: string;
  /** De inhoud als HTML; platte tekst is al omgezet */
  html: string;
}

/** Een heel gesprek, oudste bericht eerst. */
export interface MailThread {
  id: string;
  subject: string;
  messages: MailMessage[];
}

export interface MailPage {
  items: MailSummary[];
  /** Waarmee de volgende pagina opgehaald wordt; null als er niets meer is */
  nextPageToken: string | null;
}

/** De sleutels die de aanbieder na het inloggen teruggeeft. */
export interface MailTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * Wat elke aanbieder moet kunnen. De inbox praat alleen met dit; of de mail
 * uit Gmail of Outlook komt maakt daar niets uit.
 */
export interface MailProvider {
  authorizeUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<MailTokens>;
  refresh(refreshToken: string): Promise<MailTokens>;
  /** Het mailadres van de gekoppelde mailbox */
  address(accessToken: string): Promise<string>;
  list(accessToken: string, options: { unreadOnly: boolean; pageToken?: string }): Promise<MailPage>;
  thread(accessToken: string, id: string): Promise<MailThread>;
  markRead(accessToken: string, id: string): Promise<void>;
  /** Antwoordt op het laatste bericht in het gesprek; komt ook in Verzonden te staan */
  reply(accessToken: string, id: string, html: string, ownAddress: string): Promise<void>;
  /** Trekt de toegang in bij de aanbieder, voor zover die dat kent */
  revoke(token: string): Promise<void>;
}

/** De koppeling is verlopen of ingetrokken; opnieuw inloggen is nodig. */
export class MailAuthError extends Error {}
