// Losse constanten zonder database-afhankelijkheden, zodat de browser
// deze kan importeren zonder de Supabase-client mee te nemen.

/** Eenheden waarin een aannemer regels uitschrijft */
export const UNITS = ['stuks', 'uur', 'dag', 'm', 'm²', 'm³', 'kg', 'ton', 'post'] as const;
export type Unit = (typeof UNITS)[number];
