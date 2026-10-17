// Losse constanten zonder database-afhankelijkheden, zodat de browser
// deze kan importeren zonder de Supabase-client mee te nemen.

/** De naam van het systeem, zoals hij in het tabblad van de browser komt */
export const APP_NAME = 'Synbased';

/** "Offertes - Synbased". Zonder titel blijft alleen de naam over. */
export function pageTitle(title?: string): string {
  return title ? `${title} - ${APP_NAME}` : APP_NAME;
}

/**
 * Wat de inlogpagina terugkrijgt als het wachtwoord klopt maar er nog een
 * code uit de authenticator-app nodig is, of als die code niet klopt. NextAuth
 * geeft de tekst van een fout uit authorize door als `error`.
 */
export const TWO_FACTOR_REQUIRED = '2FA_REQUIRED';
export const TWO_FACTOR_INVALID = '2FA_INVALID';
/** Te vaak mis: dit account staat even op slot (zie lib/rate-limit) */
export const TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS';

/** Zo kort mag een nieuw wachtwoord minimaal zijn */
export const MIN_PASSWORD_LENGTH = 8;

/** De statussen van een offerte, met hun naam en hun kleur in de lijst. */
export const QUOTE_STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: 'Concept', className: 'status-draft' },
  sent: { label: 'Verzonden', className: 'status-sent' },
  approved: { label: 'Goedgekeurd', className: 'status-paid' },
  rejected: { label: 'Afgewezen', className: 'status-cancelled' },
  expired: { label: 'Verlopen', className: 'status-cancelled' },
};

/** Eenheden waarin een aannemer regels uitschrijft */
export const UNITS = ['stuks', 'uur', 'dag', 'm', 'm²', 'm³', 'kg', 'ton', 'post'] as const;
