/** Verplaatst één ding in een lijst naar een andere plek. */
export function verplaats<T>(lijst: T[], van: number, naar: number): T[] {
  if (van === naar) return lijst;
  if (van < 0 || naar < 0 || van >= lijst.length || naar >= lijst.length) return lijst;

  const kopie = lijst.slice();
  const [ding] = kopie.splice(van, 1);
  kopie.splice(naar, 0, ding);
  return kopie;
}
