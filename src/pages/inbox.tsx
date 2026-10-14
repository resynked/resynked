import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { MailOpen, RefreshCw } from 'lucide-react';
import Layout from '@/components/Layout';
import MailBody from '@/components/MailBody';
import RichTextEditor from '@/components/RichTextEditor';
import Toggle from '@/components/Toggle';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useMailAccount } from '@/hooks/useMailAccount';
import { isRichTextEmpty } from '@/lib/richtext';
import { formatDate } from '@/lib/utils';
import type { MailAddress, MailSummary, MailThread } from '@/lib/mail/types';

/** "JJ" voor Jan Jansen, "J" voor jan@voorbeeld.nl. */
function initials(address: MailAddress): string {
  const name = address.name && address.name !== address.email ? address.name : address.email.split('@')[0];
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** "zojuist", "20 min", "3 uur", "2 d", en daarna de datum. */
function timeAgo(date: string): string {
  const minutes = Math.floor((Date.now() - Date.parse(date)) / 60_000);
  if (minutes < 1) return 'zojuist';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} uur`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))} d`;
  return formatDate(date);
}

function displayName(address: MailAddress): string {
  return address.name || address.email;
}

/**
 * De Inbox: de mail uit Gmail of Outlook, links de gesprekken en rechts het
 * gesprek dat je openklikt. Antwoorden gaat via de mailbox zelf, dus het staat
 * daar ook in Verzonden.
 */
export default function InboxPage() {
  const toast = useToast();
  const account = useMailAccount();

  const [items, setItems] = useState<MailSummary[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // De koppeling is verlopen of ingetrokken; dan helpt alleen opnieuw koppelen
  const [needsReconnect, setNeedsReconnect] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<MailThread | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);

  /** Een verzoek aan de mail-API; een verlopen koppeling wordt apart herkend. */
  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, init);
    const data = await response.json().catch(() => ({}));

    if (response.status === 409 && data.reconnect) {
      setNeedsReconnect(true);
      throw new Error(data.error);
    }
    if (!response.ok) throw new Error(data.error || 'De mailbox is niet bereikbaar');
    return data;
  }, []);

  const loadList = useCallback(
    async (page?: string) => {
      const params = new URLSearchParams();
      if (unreadOnly) params.set('unread', '1');
      if (page) params.set('page', page);

      if (page) setIsLoadingMore(true);
      else setIsLoadingList(true);

      try {
        const data = await request(`/api/mail/messages?${params}`);
        setItems(current => (page ? [...current, ...data.items] : data.items));
        setNextPage(data.nextPageToken);
      } catch (error: any) {
        toast.error('Inbox', error.message);
      } finally {
        setIsLoadingList(false);
        setIsLoadingMore(false);
      }
    },
    [unreadOnly, request, toast]
  );

  useEffect(() => {
    if (account) loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, unreadOnly]);

  const open = async (item: MailSummary) => {
    setSelectedId(item.id);
    setThread(null);
    setReply('');
    setIsLoadingThread(true);

    try {
      setThread(await request(`/api/mail/messages/${encodeURIComponent(item.id)}`));
    } catch (error: any) {
      toast.error('Inbox', error.message);
    } finally {
      setIsLoadingThread(false);
    }

    // Openen is lezen, ook in Gmail of Outlook zelf
    if (item.unread) {
      setItems(current => current.map(i => (i.id === item.id ? { ...i, unread: false } : i)));
      request(`/api/mail/messages/${encodeURIComponent(item.id)}`, { method: 'PATCH' }).catch(() => {});
    }
  };

  const send = async () => {
    if (!selectedId || isRichTextEmpty(reply)) return;

    setIsSending(true);
    try {
      await request(`/api/mail/messages/${encodeURIComponent(selectedId)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: reply }),
      });

      toast.success('Verstuurd', 'Je antwoord is verstuurd');
      setReply('');
      setThread(await request(`/api/mail/messages/${encodeURIComponent(selectedId)}`));
    } catch (error: any) {
      toast.error('Versturen mislukt', error.message);
    } finally {
      setIsSending(false);
    }
  };

  // Nog niets gekoppeld, of de koppeling werkt niet meer
  if (account === null || needsReconnect) {
    return (
      <Layout title="Inbox">
        <div className="empty-state">
          <h2>{needsReconnect ? 'Koppel je mailbox opnieuw' : 'Inbox staat nog uit'}</h2>
          <p>
            {needsReconnect
              ? 'De toegang tot je mailbox is verlopen of ingetrokken. Zet de Inbox opnieuw aan om je mail weer te zien.'
              : 'Koppel je Gmail- of Outlook-mailbox bij Instellingen > Plug-ins om je mail hier te lezen en te beantwoorden.'}
          </p>
          <Link href="/settings?tab=plugins" className="button">
            Naar Plug-ins
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Inbox">
      <div className="inbox">
        <div className="inbox-list">
          <div className="list-header">
            <h1>Inbox</h1>
            <div className="actions">
              <label className="toggle-label">
                <Toggle label="Alleen ongelezen" checked={unreadOnly} onChange={setUnreadOnly} />
                <span>Ongelezen</span>
              </label>
              <button
                type="button"
                className="button icon"
                aria-label="Vernieuwen"
                onClick={() => loadList()}
                disabled={isLoadingList}
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {isLoadingList ? (
            <div className="list-loading">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} height="3.5rem" style={{ marginBottom: 'var(--space10)' }} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="list-empty">{unreadOnly ? 'Geen ongelezen mail.' : 'Je inbox is leeg.'}</p>
          ) : (
            <>
              {items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`inbox-item${item.id === selectedId ? ' active' : ''}${item.unread ? ' unread' : ''}`}
                  onClick={() => open(item)}
                >
                  <span className="dot" aria-label={item.unread ? 'Ongelezen' : undefined} />
                  <span className="avatar">{initials(item.from)}</span>
                  <span className="summary">
                    <span className="from">{displayName(item.from)}</span>
                    <span className="subject">{item.subject}</span>
                    <span className="snippet">{item.snippet}</span>
                    <span className="meta">{timeAgo(item.date)}</span>
                  </span>
                </button>
              ))}

              {nextPage && (
                <div className="list-more">
                  <button
                    type="button"
                    className="button cancel"
                    disabled={isLoadingMore}
                    onClick={() => loadList(nextPage)}
                  >
                    {isLoadingMore ? 'Laden...' : 'Meer laden'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="inbox-detail">
          {!selectedId ? (
            <div className="empty-state">
              <MailOpen size={22} />
              <h2>Selecteer een bericht</h2>
              <p>Lees het gesprek en antwoord zonder je inbox te verlaten.</p>
            </div>
          ) : isLoadingThread || !thread ? (
            <div className="thread">
              <Skeleton height="1.5rem" width="50%" style={{ marginBottom: 'var(--space20)' }} />
              <Skeleton height="12rem" />
            </div>
          ) : (
            <div className="thread">
              <h2>{thread.subject}</h2>

              {thread.messages.map(message => (
                <div key={message.id} className="message">
                  <div className="message-header">
                    <span className="avatar">{initials(message.from)}</span>
                    <span className="sender">
                      <span className="from">{displayName(message.from)}</span>
                      <span className="meta">
                        {message.from.email}
                        {message.to.length > 0 && ` aan ${message.to.map(displayName).join(', ')}`}
                      </span>
                    </span>
                    <span className="meta">{timeAgo(message.date)}</span>
                  </div>
                  <MailBody html={message.html} />
                </div>
              ))}

              <div className="reply">
                <RichTextEditor value={reply} onChange={setReply} placeholder="Schrijf je antwoord..." />
                <div className="actions">
                  <button
                    type="button"
                    className="button"
                    disabled={isSending || isRichTextEmpty(reply)}
                    onClick={send}
                  >
                    {isSending ? 'Versturen...' : 'Antwoorden'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
