import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Versleutelen van gevoelige gegevens in de database, zoals de sleutels
 * waarmee we bij iemands mailbox kunnen. Lekt de database ooit uit, dan heeft
 * niemand daar iets aan zonder MAIL_ENCRYPTION_KEY.
 *
 * AES-256-GCM: naast geheimhouding merkt dit ook als iemand met de opgeslagen
 * waarde heeft geknoeid.
 */

function key(): Buffer {
  const secret = process.env.MAIL_ENCRYPTION_KEY;
  if (!secret) throw new Error('Zet MAIL_ENCRYPTION_KEY in de omgevingsvariabelen');

  // Elke lengte is goed; er komt altijd een sleutel van 32 bytes uit
  return createHash('sha256').update(secret).digest();
}

/** Versleutelt tekst tot "iv.tag.inhoud", alle drie base64url. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, data].map(part => part.toString('base64url')).join('.');
}

export function decrypt(stored: string): string {
  const [iv, tag, data] = stored.split('.').map(part => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
