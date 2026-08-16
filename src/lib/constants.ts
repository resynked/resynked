// Losse constanten zonder database-afhankelijkheden, zodat de browser
// deze kan importeren zonder de Supabase-client mee te nemen.

/** De naam van het systeem, zoals hij in het tabblad van de browser komt */
export const APP_NAME = 'Resynked';

/** "Offertes - Resynked". Zonder titel blijft alleen de naam over. */
export function pageTitle(title?: string): string {
  return title ? `${title} - ${APP_NAME}` : APP_NAME;
}

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
export type Unit = (typeof UNITS)[number];
