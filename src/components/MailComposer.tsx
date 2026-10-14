import { ChevronUp, Minus, Send, Trash2, X } from 'lucide-react';
import MailBody from '@/components/MailBody';
import RichTextEditor from '@/components/RichTextEditor';
import ToolButton from '@/components/ToolButton';
import { isRichTextEmpty } from '@/lib/richtext';
import { initials } from '@/lib/mail/display';
import type { MailAddress } from '@/lib/mail/types';

export type ComposerMode = 'reply' | 'forward';

interface MailComposerProps {
  mode: ComposerMode;
  /** Bij antwoorden: naar wie het gaat */
  recipient: MailAddress | null;
  /** Bij doorsturen: de adressen die je zelf intypt */
  forwardTo: string;
  onForwardToChange: (value: string) => void;
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
  forwardTo,
  onForwardToChange,
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
  const canSend = mode === 'reply' ? !isRichTextEmpty(html) : forwardTo.trim() !== '';

  return (
    <div className={`composer${minimized ? ' minimized' : ''}`}>
      <div
        className="composer-header"
        onClick={minimized ? () => onMinimizedChange(false) : undefined}
      >
        <span className="label">{mode === 'reply' ? 'Antwoorden aan' : 'Doorsturen aan'}</span>

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
            value={forwardTo}
            autoFocus
            placeholder="naam@voorbeeld.nl, meerdere met een komma"
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onForwardToChange(event.target.value)}
          />
        )}

        <span className="actions" onClick={(event) => event.stopPropagation()}>
          <ToolButton
            title={minimized ? 'Openklappen' : 'Inklappen'}
            onClick={() => onMinimizedChange(!minimized)}
          >
            {minimized ? <ChevronUp size={15} /> : <Minus size={15} />}
          </ToolButton>
          {mode === 'forward' && (
            <ToolButton title="Sluiten" onClick={onClose}>
              <X size={15} />
            </ToolButton>
          )}
        </span>
      </div>

      {!minimized && (
        <>
          <RichTextEditor
            value={html}
            onChange={onHtmlChange}
            placeholder={mode === 'reply' ? 'Schrijf je antwoord...' : 'Schrijf er iets bij (mag leeg blijven)...'}
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
              {isSending ? 'Versturen...' : mode === 'reply' ? 'Antwoorden' : 'Doorsturen'}
              <Send size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
