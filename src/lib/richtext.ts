/**
 * De opmaak van een tekstelement.
 *
 * De editor levert HTML op. Teksten van vóór de editor staan als platte tekst
 * in de database, met ## voor een kop en - voor een opsomming; die worden bij
 * het tonen en bij het openen omgezet, zodat oude offertes hetzelfde blijven.
 */

/** De enige tags die in een tekstelement mogen staan. */
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
]);

/**
 * Browsers schrijven hetzelfde op verschillende manieren: Chrome maakt <b> waar
 * Firefox <strong> maakt. Hier komt alles op één vorm uit, zodat de opmaak niet
 * wegvalt bij het opschonen.
 */
const TAG_ALIASES: Record<string, string> = {
  b: 'strong',
  i: 'em',
  strike: 's',
  del: 's',
  div: 'p',
};

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/**
 * Onschadelijk maken van tekst die tussen de tags staat. Een & die al het begin
 * van een entiteit is blijft staan, anders zou de &nbsp; die de browser zelf
 * neerzet als losse letters in het document belanden. Aanhalingstekens hoeven
 * hier niet: dit is tekst, geen attribuut.
 */
function escapeText(value: string): string {
  return value
    .replace(/&(?!#?[a-zA-Z0-9]{1,8};)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Eén tag. De aanhalingstekens staan er expliciet in, zodat een attribuut met
 * een > erin niet halverwege afgekapt wordt.
 */
const TAG_PATTERN = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

/** Haalt de href uit de attributen van een a-tag, als die te vertrouwen is. */
function safeHref(attributes: string): string | null {
  const match = attributes.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
  if (!match) return null;

  const href = (match[2] ?? match[3] ?? match[4] ?? '').trim();

  // Alleen naar buiten of naar een mailadres; javascript: en data: blijven eruit
  if (!/^(https?:\/\/|mailto:|\/)/i.test(href)) return null;

  return escapeHtml(href);
}

/** Bouwt één tag opnieuw op, of geeft niets terug als hij niet mag. */
function rebuildTag(slash: string, rawName: string, attributes: string): string {
  const tag = TAG_ALIASES[rawName.toLowerCase()] || rawName.toLowerCase();

  if (!ALLOWED_TAGS.has(tag)) return '';
  if (slash) return `</${tag}>`;
  if (tag === 'br') return '<br>';

  if (tag === 'a') {
    const href = safeHref(attributes);
    return href ? `<a href="${href}" target="_blank" rel="noreferrer noopener">` : '<a>';
  }

  return `<${tag}>`;
}

/**
 * Houdt alleen de toegestane opmaak over.
 *
 * De tekst wordt in stukken geknipt: wat als tag herkend wordt, wordt opnieuw
 * opgebouwd uit alleen zijn naam en — bij een link — een gecontroleerde href;
 * al het andere is tekst en gaat er onschadelijk gemaakt door. Daarmee komt er
 * geen enkele < in de uitvoer die wij er niet zelf hebben neergezet. Dat is het
 * punt: alleen de losse tags weghalen zou een half kapotte tag laten staan, die
 * de browser bij het tonen alsnog als opmaak leest.
 */
export function sanitizeRichText(html: string): string {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');

  let result = '';
  let readUpTo = 0;
  let match: RegExpExecArray | null;

  TAG_PATTERN.lastIndex = 0;

  while ((match = TAG_PATTERN.exec(withoutComments)) !== null) {
    result += escapeText(withoutComments.slice(readUpTo, match.index));
    result += rebuildTag(match[1], match[2], match[3]);
    readUpTo = TAG_PATTERN.lastIndex;
  }

  return result + escapeText(withoutComments.slice(readUpTo));
}

/** Of er al opmaak in de waarde zit, of dat het nog platte tekst is. */
export function isRichText(value: string): boolean {
  return /<(p|br|strong|b|em|i|u|s|strike|h2|h3|ul|ol|li|a|blockquote|div)\b/i.test(value);
}

/**
 * Zet platte tekst om naar opmaak, met dezelfde regels als de tekstvelden van
 * vóór de editor: een regel met ## wordt een kop, een regel met - een punt in
 * een opsomming, de rest een alinea.
 */
export function plainTextToRichText(text: string): string {
  const parts: string[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    parts.push(`<ul>${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>`);
    bullets = [];
  };

  text.split('\n').forEach((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('- ')) {
      bullets.push(trimmed.slice(2));
      return;
    }

    flushBullets();

    if (trimmed.startsWith('## ')) {
      parts.push(`<h3>${escapeHtml(trimmed.slice(3))}</h3>`);
    } else if (trimmed) {
      parts.push(`<p>${escapeHtml(trimmed)}</p>`);
    }
  });

  flushBullets();

  return parts.join('');
}

/** De opmaak zoals hij getoond mag worden, ongeacht hoe hij is opgeslagen. */
export function toDisplayHtml(value: string): string {
  return isRichText(value) ? sanitizeRichText(value) : plainTextToRichText(value);
}

/** Of er na het weghalen van alle tags nog tekst overblijft. */
export function isRichTextEmpty(value: string): boolean {
  return (
    value
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim() === ''
  );
}
