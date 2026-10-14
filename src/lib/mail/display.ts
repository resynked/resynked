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

/** "zojuist", "20 min", "3 uur", "2 d", en daarna de datum. */
export function timeAgo(date: string): string {
  const minutes = Math.floor((Date.now() - Date.parse(date)) / 60_000);
  if (minutes < 1) return 'zojuist';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} uur`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))} d`;
  return formatDate(date);
}
