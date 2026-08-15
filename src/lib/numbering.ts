/**
 * Eigen nummering voor offertes en facturen.
 *
 * De aannemer vult in wat het eerstvolgende nummer is, bijvoorbeeld 20260050.
 * Daarna telt het systeem de cijfers achteraan op: 20260051, 20260052. Zo kan
 * iedereen zijn eigen opbouw aanhouden — met een jaartal ervoor, met letters
 * ervoor, of gewoon een doorlopend nummer.
 */

/** De cijfers achteraan, met wat ervoor staat. Null als er geen cijfers zijn. */
function splitTrailingNumber(value: string): { prefix: string; digits: string } | null {
  const match = value.match(/^(.*?)(\d+)$/);
  if (!match) return null;

  return { prefix: match[1], digits: match[2] };
}

/**
 * Telt er één bij op, cijfer voor cijfer van achter naar voren.
 *
 * Dit gaat bewust niet via een getal: een nummer als 20260050 is prima, maar
 * een langere reeks loopt tegen de grens aan waarop JavaScript getallen nog
 * precies kan optellen. Cijfer voor cijfer werkt bij elke lengte, en de
 * voorloopnullen blijven vanzelf staan.
 */
function incrementDigits(digits: string): string {
  const cijfers = digits.split('');
  let i = cijfers.length - 1;

  while (i >= 0) {
    if (cijfers[i] === '9') {
      cijfers[i] = '0';
      i--;
    } else {
      cijfers[i] = String(Number(cijfers[i]) + 1);
      break;
    }
  }

  // Alles was negen: er komt een cijfer bij, zoals 999 naar 1000
  return i < 0 ? '1' + cijfers.join('') : cijfers.join('');
}

/**
 * Het nummer dat na dit nummer komt.
 *
 * De voorloopnullen blijven staan zolang het nummer even lang blijft: van
 * 20260050 naar 20260051, en van OFF-009 naar OFF-010. Loopt het over de breedte
 * heen, dan wordt het nummer een cijfer langer — 099 wordt 100 en niet 00.
 *
 * Staan er geen cijfers achteraan, dan valt er niets op te tellen en komt het
 * nummer ongewijzigd terug; de aannemer past het dan zelf aan.
 */
export function nextNumber(current: string): string {
  const parts = splitTrailingNumber(current.trim());
  if (!parts) return current.trim();

  return parts.prefix + incrementDigits(parts.digits);
}

/** Of dit iets is waar het systeem mee verder kan tellen. */
export function isCountable(value: string | null | undefined): boolean {
  return !!value && splitTrailingNumber(value.trim()) !== null;
}
