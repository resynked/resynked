import { randomUUID } from 'crypto';
import { supabaseAdmin } from './supabase';

/**
 * Bestanden van een bedrijf, zoals bonnetjes en inkoopfacturen, in Supabase
 * Storage. De bucket "documents" is afgeschermd: een bestand gaat alleen via
 * onze eigen server naar buiten, na inloggen (zie MIGRATION.sql deel 18).
 *
 * Elk bedrijf heeft zijn eigen map, met het tenant-id voorop.
 */

const BUCKET = 'documents';

/** Wat we aannemen: foto's en PDF's, zoals een bonnetje of inkoopfactuur */
export const DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/** Vercel neemt niet meer dan 4,5 MB per aanvraag aan; base64 maakt een bestand een derde groter */
export const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;

/** Een bestand zoals de browser het stuurt: een data-URL met de naam erbij */
export interface IncomingFile {
  data: string;
  name: string;
}

/** Leest een data-URL uit; gooit een leesbare fout als het type of de grootte niet past */
export function parseDataUrl(dataUrl: string): { type: string; buffer: Buffer } {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Het bestand kon niet gelezen worden');

  const [, type, base64] = match;
  if (!DOCUMENT_TYPES.includes(type)) throw new Error('Alleen JPG, PNG, WebP of PDF');

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_DOCUMENT_BYTES) throw new Error('Het bestand is groter dan 3 MB');

  return { type, buffer };
}

/** Zet een bestand in de map van het bedrijf en geeft terug waar het staat */
export async function uploadDocument(tenantId: string, folder: string, file: IncomingFile) {
  const { type, buffer } = parseDataUrl(file.data);
  const safeName = (file.name || 'bestand').replace(/[^\w.\- ]+/g, '').slice(-80) || 'bestand';
  const path = `${tenantId}/${folder}/${randomUUID()}-${safeName}`;

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, { contentType: type });
  if (error) throw new Error(`Het bestand kon niet worden opgeslagen: ${error.message}`);

  return { path, name: file.name || safeName, type };
}

/** Haalt een bestand op; alleen binnen de map van dit bedrijf */
export async function downloadDocument(tenantId: string, path: string) {
  if (!path.startsWith(`${tenantId}/`)) throw new Error('Bestand niet gevonden');

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error('Bestand niet gevonden');

  return { buffer: Buffer.from(await data.arrayBuffer()), type: data.type };
}

export async function removeDocument(tenantId: string, path: string | null | undefined) {
  if (!path || !path.startsWith(`${tenantId}/`)) return;
  await supabaseAdmin.storage.from(BUCKET).remove([path]);
}
