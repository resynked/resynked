import { ChevronUp, Minus, Send, Trash2, X } from 'lucide-react';
import MailBody from '@/components/MailBody';
import RichTextEditor from '@/components/RichTextEditor';
import ToolButton from '@/components/ToolButton';
import { isRichTextEmpty } from '@/lib/richtext';
import { initials } from '@/lib/mail/display';
import type { MailAddress } from '@/lib/mail/types';

export type ComposerMode = 'reply' | 'forward' | 'new';

const LABELS: Record<ComposerMode, string> = {
  reply: 'Antwoorden aan',
  forward: 'Doorsturen aan',
  new: 'Nieuw bericht aan',
};

interface MailComposerProps {
  mode: ComposerMode;
  /** Bij antwoorden: naar wie het gaat */
  recipient: MailAddress | null;
  /** Bij doorsturen en een nieuw bericht: de adressen die je zelf intypt */
  to: string;
  onToChange: (value: string) => void;
  /** Alleen bij een nieuw bericht; anders volgt het onderwerp het gesprek */
  subject: string;
  onSubjectChange: (value: string) => void;
  html: string;
  onHtmlChange: (html: string) => void;
  /** De handtekening uit Gmail; komt er bij het versturen onder */
  signature: string;
  minimized: boolean;
  onMinimizedChange: (minimized: boolean) => void;
  /** Terug naar gewoon antwoorden, bijvoorbeeld na het doorsturen */
  onClose: () => void;
  onDiscard: () => void;
  onSend: () => void;
  isSending: boolean;
}

/**
 * Het venster om te antwoorden of door te sturen. Het staat vast onderin het
 * gesprek, zodat je kunt reageren terwijl je nog aan het lezen bent. Ingeklapt
 * is het één regel; een klik erop klapt het open.
 */
export default function MailComposer({
  mode,
  recipient,
  to,
  onToChange,
  subject,
  onSubjectChange,
  html,
  onHtmlChange,
  signature,
  minimized,
  onMinimizedChange,
  onClose,
  onDiscard,
  onSend,
  isSending,
}: MailComposerProps) {
  // Doorsturen mag zonder eigen tekst; antwoorden en een nieuw bericht niet
  const canSend =
    (mode === 'reply' || to.trim() !== '') && (mode === 'forward' || !isRichTextEmpty(html));

  return (
    <div className={`composer${minimized ? ' minimized' : ''}${mode === 'new' ? ' standalone' : ''}`}>
      <div
        className="composer-header"
        onClick={minimized ? () => onMinimizedChange(false) : undefined}
      >
        <span className="label">{LABELS[mode]}</span>

        {mode === 'reply' ? (
          recipient && (
            <span className="recipient">
              <span className="avatar">{initials(recipient)}</span>
              <span className="from">{recipient.name || recipient.email}</span>
              {recipient.name !== recipient.email && <span className="meta">{recipient.email}</span>}
            </span>
          )
        ) : (
          <input
            type="text"
            value={to}
            autoFocus
            placeholder="naam@voorbeeld.nl, meerdere met een komma"
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onToChange(event.target.value)}
          />
        )}

        <span className="actions" onClick={(event) => event.stopPropagation()}>
          {mode !== 'new' && (
            <ToolButton
              title={minimized ? 'Openklappen' : 'Inklappen'}
              onClick={() => onMinimizedChange(!minimized)}
            >
              {minimized ? <ChevronUp size={15} /> : <Minus size={15} />}
            </ToolButton>
          )}
          {mode !== 'reply' && (
            <ToolButton title="Sluiten" onClick={onClose}>
              <X size={15} />
            </ToolButton>
          )}
        </span>
      </div>

      {!minimized && (
        <>
          {mode === 'new' && (
            <div className="composer-subject">
              <input
                type="text"
                value={subject}
                placeholder="Onderwerp"
                aria-label="Onderwerp"
                onChange={(event) => onSubjectChange(event.target.value)}
              />
            </div>
          )}

          <RichTextEditor
            value={html}
            onChange={onHtmlChange}
            placeholder={
              mode === 'forward' ? 'Schrijf er iets bij (mag leeg blijven)...' : mode === 'new' ? 'Schrijf je bericht...' : 'Schrijf je antwoord...'
            }
          />

          {signature && (
            <div className="composer-signature">
              <MailBody html={signature} />
            </div>
          )}

          <div className="composer-footer">
            <ToolButton title="Concept weggooien" className="delete" onClick={onDiscard}>
              <Trash2 size={15} />
            </ToolButton>
            <button type="button" className="button with-icon" disabled={!canSend || isSending} onClick={onSend}>
              {isSending ? 'Versturen...' : mode === 'reply' ? 'Antwoorden' : mode === 'forward' ? 'Doorsturen' : 'Versturen'}
              <Send size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
