import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { APP_NAME } from './constants';

/**
 * Tweestapsverificatie met een authenticator-app (Google Authenticator,
 * Microsoft Authenticator, 1Password...), volgens TOTP (RFC 6238).
 *
 * De app en de server kennen dezelfde geheime sleutel. Beide rekenen daaruit
 * en uit de tijd elke 30 seconden dezelfde code van 6 cijfers uit; er gaat
 * niets over het internet. De sleutel staat versleuteld in de database.
 */

const PERIOD = 30;
const DIGITS = 6;
/** Eén stap ernaast mag ook, voor een klok die een paar seconden afwijkt */
const WINDOW = 1;

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error('Ongeldige sleutel');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Een nieuwe geheime sleutel van 160 bits, zoals de apps hem verwachten */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

/** De code bij één tijdstap */
function codeAt(secret: string, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(message).digest();

  // Dynamic truncation uit de RFC: vier bytes vanaf de plek die de laatste byte aangeeft
  const offset = hmac[hmac.length - 1] & 15;
  const number = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(number % 10 ** DIGITS).padStart(DIGITS, '0');
}

function equal(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Controleert een code uit de app. Geeft de tijdstap terug als hij klopt, en
 * null als hij niet klopt. Een code die al eens gebruikt is (op of vóór
 * lastCounter) telt niet, zodat een onderschepte code niet nog eens werkt.
 */
export function verifyCode(secret: string, code: string, lastCounter: number | null = null): number | null {
  const clean = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return null;

  const now = Math.floor(Date.now() / 1000 / PERIOD);
  for (let counter = now - WINDOW; counter <= now + WINDOW; counter++) {
    if (lastCounter !== null && counter <= lastCounter) continue;
    if (equal(codeAt(secret, counter), clean)) return counter;
  }
  return null;
}

/** De link in de QR-code. De app toont "Synbased" met het e-mailadres eronder */
export function otpauthUrl(secret: string, email: string): string {
  const label = encodeURIComponent(`${APP_NAME}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer: APP_NAME,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params}`;
}

/** Leesbare back-upcodes zonder letters die op elkaar lijken (0/O, 1/I) */
const BACKUP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

export function hashBackupCode(code: string): string {
  return createHash('sha256').update(normalizeBackupCode(code)).digest('hex');
}

/** Tien codes als "ABCD-EFGH", elk één keer te gebruiken als je telefoon kwijt is */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8);
    const chars = Array.from(bytes, byte => BACKUP_ALPHABET[byte % BACKUP_ALPHABET.length]).join('');
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
}

/**
 * Controleert een back-upcode tegen de bewaarde hashes. Geeft de hashes terug
 * die overblijven als hij klopt (de gebruikte valt eruit), anders null.
 */
export function consumeBackupCode(hashes: string[] | null, code: string): string[] | null {
  if (!hashes?.length) return null;
  const hash = hashBackupCode(code);
  const index = hashes.findIndex(stored => equal(stored, hash));
  return index === -1 ? null : hashes.filter((_, i) => i !== index);
}
