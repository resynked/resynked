import { Download, File, FileArchive, FileImage, FileSpreadsheet, FileText } from 'lucide-react';
import { attachmentUrl, type MailAttachment } from '@/lib/mail/types';

/** "2,4 MB", "830 kB" */
function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

/** Een icoon dat past bij het soort bestand. */
function iconFor(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (/pdf|word|text|document/.test(mimeType)) return FileText;
  if (/sheet|excel|csv/.test(mimeType)) return FileSpreadsheet;
  if (/zip|compressed|archive/.test(mimeType)) return FileArchive;
  return File;
}

/**
 * De bijlagen onder een bericht. Plaatjes die in de tekst zelf staan, zoals
 * een logo in de handtekening, staan hier niet: die zie je al in de mail.
 */
export default function MailAttachments({ messageId, attachments }: { messageId: string; attachments: MailAttachment[] }) {
  const files = attachments.filter(attachment => !attachment.inline);
  if (files.length === 0) return null;

  return (
    <div className="mail-attachments">
      <span className="label">
        {files.length === 1 ? '1 bijlage' : `${files.length} bijlagen`}
      </span>
      <div className="list">
        {files.map(file => {
          const Icon = iconFor(file.mimeType);
          return (
            <span key={file.id} className="attachment">
              <a className="open" href={attachmentUrl(messageId, file.id)} target="_blank" rel="noreferrer">
                <span className="icon">
                  <Icon size={16} />
                </span>
                <span className="name">{file.name}</span>
                {file.size > 0 && <span className="size">{formatSize(file.size)}</span>}
              </a>
              <a
                className="download"
                href={attachmentUrl(messageId, file.id, true)}
                aria-label={`${file.name} downloaden`}
                title="Downloaden"
              >
                <Download size={15} />
              </a>
            </span>
          );
        })}
      </div>
    </div>
  );
}
