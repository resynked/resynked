import { formatDate } from '@/lib/utils';
import type { MailAddress } from './types';

/** "JJ" voor Jan Jansen, "J" voor jan@voorbeeld.nl. */
export function initials(address: MailAddress): string {
  const name = address.name && address.name !== address.email ? address.name : address.email.split('@')[0];
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function displayName(address: MailAddress): string {
  return address.name || address.email;
}

// Zelf uitgeschreven in plaats van via toLocaleDateString: die zet er per
// browser wel of geen punt achter ("okt."), Gmail nooit
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const WEEKDAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

const time = (date: Date) => `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

/**
 * Zoals in de lijst van Gmail: vandaag de tijd ("14:32"), dit jaar dag en
 * maand ("15 okt"), daarvoor de hele datum ("15-10-2025").
 */
export function mailListDate(value: string): string {
  const date = new Date(value);
  if (isToday(date)) return time(date);
  if (date.getFullYear() === new Date().getFullYear()) return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return formatDate(value);
}

/** "5 minuten geleden", "3 uur geleden", "2 dagen geleden" */
function ago(date: Date): string {
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minuut' : 'minuten'} geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'dag' : 'dagen'} geleden`;
}

/**
 * Zoals boven een geopend bericht in Gmail: vandaag "14:32 (2 uur geleden)",
 * dit jaar "di 14 okt, 14:32 (1 dag geleden)", daarvoor met het jaar erbij.
 * Na een week valt het stukje tussen haakjes weg.
 */
export function mailMessageDate(value: string): string {
  const date = new Date(value);
  const recent = Date.now() - date.getTime() < 7 * 24 * 60 * 60_000 ? ` (${ago(date)})` : '';
  if (isToday(date)) return `${time(date)}${recent}`;
  const year = date.getFullYear() === new Date().getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}${year}, ${time(date)}${recent}`;
}

/** Het volledige moment, voor als je er met de muis op staat: "di 14 okt 2025, 14:32" */
export function mailFullDate(value: string): string {
  const date = new Date(value);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${time(date)}`;
}
