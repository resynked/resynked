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
  /** Met ster in Gmail, gemarkeerd (vlag) in Outlook */
  starred: boolean;
}

/** Een heel gesprek, oudste bericht eerst. */
export interface MailThread {
  id: string;
  subject: string;
  messages: MailMessage[];
}

/** Wat voor map het is; de vaste mappen krijgen hun eigen icoon. */
export type MailFolderKind = 'inbox' | 'starred' | 'important' | 'sent' | 'drafts' | 'archive' | 'spam' | 'trash' | 'custom';

/** Een map in Outlook, of een label in Gmail. */
export interface MailFolder {
  id: string;
  name: string;
  kind: MailFolderKind;
  /** Hoeveel ongelezen, als de aanbieder dat meteen meegeeft */
  unread?: number;
}

/** De map waarmee de inbox opent. */
export const INBOX_FOLDER = 'inbox';

export interface MailListOptions {
  folder: string;
  unreadOnly: boolean;
  /** Zoeken in alle mail; dan geldt de map niet */
  search?: string;
  pageToken?: string;
}

export interface MailPage {
  items: MailSummary[];
  /** Waarmee de volgende pagina opgehaald wordt; null als er niets meer is */
  nextPageToken: string | null;
}

/** Een afspraak uit Google Calendar of de Outlook-agenda. */
export interface CalendarEvent {
  id: string;
  title: string;
  /** ISO-tijd; bij een afspraak van de hele dag alleen de datum (2026-10-14) */
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  /** De afspraak openen in Google Calendar of Outlook */
  url: string | null;
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
  list(accessToken: string, options: MailListOptions): Promise<MailPage>;
  folders(accessToken: string): Promise<MailFolder[]>;
  /** Hoeveel gesprekken er ongelezen in de inbox staan */
  unreadCount(accessToken: string): Promise<number>;
  /** De handtekening die in Gmail of Outlook is ingesteld, als HTML; leeg als er geen is */
  signature(accessToken: string, ownAddress: string): Promise<string>;
  thread(accessToken: string, id: string): Promise<MailThread>;
  markRead(accessToken: string, id: string): Promise<void>;
  /** Antwoordt op het laatste bericht in het gesprek; komt ook in Verzonden te staan */
  reply(accessToken: string, id: string, html: string, ownAddress: string): Promise<void>;
  /** Uit de inbox halen, maar bewaren: Archief in Outlook, "Alle e-mail" in Gmail */
  archive(accessToken: string, id: string): Promise<void>;
  /** Naar de prullenbak; daar haal je het nog terug */
  trash(accessToken: string, id: string): Promise<void>;
  /** Een ster (Gmail) of vlag (Outlook) op één bericht zetten of weghalen */
  setStarred(accessToken: string, messageId: string, starred: boolean): Promise<void>;
  /** Een nieuw bericht, los van een bestaand gesprek */
  compose(accessToken: string, to: string[], subject: string, html: string, ownAddress: string): Promise<void>;
  /** Stuurt één bericht uit het gesprek door, met het origineel eronder */
  forward(accessToken: string, threadId: string, messageId: string, to: string[], html: string, ownAddress: string): Promise<void>;
  /** De afspraken in de hoofdagenda tussen twee momenten, oudste eerst */
  events(accessToken: string, from: Date, to: Date): Promise<CalendarEvent[]>;
  /** Trekt de toegang in bij de aanbieder, voor zover die dat kent */
  revoke(token: string): Promise<void>;
}

/** De koppeling is verlopen of ingetrokken; opnieuw inloggen is nodig. */
export class MailAuthError extends Error {}
