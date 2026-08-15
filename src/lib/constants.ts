// Losse constanten zonder database-afhankelijkheden, zodat de browser
// deze kan importeren zonder de Supabase-client mee te nemen.

/** De naam van het systeem, zoals hij in het tabblad van de browser komt */
export const APP_NAME = 'Resynked';

/** "Offertes - Resynked". Zonder titel blijft alleen de naam over. */
export function pageTitle(title?: string): string {
  return title ? `${title} - ${APP_NAME}` : APP_NAME;
}

/** Eenheden waarin een aannemer regels uitschrijft */
export const UNITS = ['stuks', 'uur', 'dag', 'm', 'm²', 'm³', 'kg', 'ton', 'post'] as const;
export type Unit = (typeof UNITS)[number];
