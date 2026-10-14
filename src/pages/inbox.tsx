import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  File,
  Flag,
  Forward,
  Inbox,
  MailOpen,
  OctagonAlert,
  RefreshCw,
  Reply,
  Search,
  Send,
  SquarePen,
  Star,
  Tag,
  Trash2,
} from 'lucide-react';
import Layout from '@/components/Layout';
import MailBody from '@/components/MailBody';
import MailComposer, { type ComposerMode } from '@/components/MailComposer';
import Toggle from '@/components/Toggle';
import ToolButton from '@/components/ToolButton';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useMailAccount } from '@/hooks/useMailAccount';
import { decreaseMailUnread, setMailUnread } from '@/hooks/useMailUnread';
import { isRichTextEmpty } from '@/lib/richtext';
import { displayName, initials, timeAgo } from '@/lib/mail/display';
import {
  INBOX_FOLDER,
  type MailAddress,
  type MailFolder,
  type MailFolderKind,
  type MailSummary,
  type MailThread,
} from '@/lib/mail/types';

const FOLDER_ICONS: Record<MailFolderKind, typeof Inbox> = {
  inbox: Inbox,
  starred: Star,
  important: Flag,
  sent: Send,
  drafts: File,
  archive: Archive,
  spam: OctagonAlert,
  trash: Trash2,
  custom: Tag,
};

/**
 * De Inbox: de mail uit Gmail of Outlook. Links de mappen of labels zoals de
 * gebruiker ze daar heeft ingericht, dan de gesprekken, en rechts het gesprek
 * dat je openklikt. Onderin dat gesprek staat altijd het venster om te
 * antwoorden of door te sturen; dat gaat via de mailbox zelf, dus het staat
 * daar ook in Verzonden.
 */
export default function InboxPage() {
  const toast = useToast();
  const account = useMailAccount();

  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [folder, setFolder] = useState(INBOX_FOLDER);
  const [searchInput, setSearchInput] = useState('');
  // Waarop echt gezocht wordt; dat loopt even achter op het typen
  const [search, setSearch] = useState('');

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

  const [signature, setSignature] = useState('');
  const [composerMode, setComposerMode] = useState<ComposerMode>('reply');
  const [composerMinimized, setComposerMinimized] = useState(true);
  const [draft, setDraft] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);
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

  const loadFolders = useCallback(async () => {
    try {
      const list: MailFolder[] = await request('/api/mail/folders');
      setFolders(list);

      // Het getal in de zijbalk meteen gelijk trekken
      const inbox = list.find(f => f.kind === 'inbox');
      if (inbox?.unread !== undefined) setMailUnread(inbox.unread);
    } catch {
      // Zonder mappen werkt de inbox nog steeds
    }
  }, [request]);

  const loadList = useCallback(
    async (page?: string) => {
      const params = new URLSearchParams({ folder });
      if (search) params.set('q', search);
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
    [folder, search, unreadOnly, request, toast]
  );

  // Mappen en de handtekening één keer, zodra bekend is dat er een mailbox is
  useEffect(() => {
    if (!account) return;

    loadFolders();
    request('/api/mail/signature')
      .then(data => setSignature(data.html || ''))
      .catch(() => {});
  }, [account, loadFolders, request]);

  useEffect(() => {
    if (account) loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, folder, search, unreadOnly]);

  // Zoeken zodra iemand even stopt met typen
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const resetComposer = () => {
    setComposerMode('reply');
    setComposerMinimized(true);
    setDraft('');
    setTo('');
    setSubject('');
    setForwardMessageId(null);
  };

  /** Een nieuw bericht, los van het gesprek dat open staat. */
  const startNew = () => {
    resetComposer();
    setComposerMode('new');
    setComposerMinimized(false);
  };

  /**
   * Een ster (Gmail) of vlag (Outlook) op één bericht. Het scherm loopt
   * meteen mee; lukt het bij de aanbieder niet, dan gaat het terug.
   */
  const toggleStar = async (messageId: string, starred: boolean) => {
    if (!selectedId) return;

    const mark = (value: boolean) =>
      setThread(current =>
        current && {
          ...current,
          messages: current.messages.map(m => (m.id === messageId ? { ...m, starred: value } : m)),
        }
      );

    mark(starred);
    try {
      await request(`/api/mail/messages/${encodeURIComponent(selectedId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, starred }),
      });
    } catch (error: any) {
      mark(!starred);
      toast.error('Inbox', error.message);
    }
  };

  const chooseFolder = (id: string) => {
    setFolder(id);
    setSearchInput('');
    setSearch('');
    setSelectedId(null);
    setThread(null);
  };

  const open = async (item: MailSummary) => {
    setSelectedId(item.id);
    setThread(null);
    resetComposer();
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
      setFolders(current =>
        current.map(f => (f.id === folder && f.unread ? { ...f, unread: f.unread - 1 } : f))
      );
      if (folder === INBOX_FOLDER) decreaseMailUnread();
      request(`/api/mail/messages/${encodeURIComponent(item.id)}`, { method: 'PATCH' }).catch(() => {});
    }
  };

  /** Naar wie een antwoord gaat: wie het laatst iets stuurde, behalve jijzelf. */
  const replyRecipient = (): MailAddress | null => {
    if (!thread) return null;
    const own = account?.email.toLowerCase();
    const others = thread.messages.filter(message => message.from.email.toLowerCase() !== own);
    const last = others[others.length - 1] || thread.messages[thread.messages.length - 1];
    return last ? (last.from.email.toLowerCase() === own ? last.to[0] || null : last.from) : null;
  };

  const startReply = () => {
    setComposerMode('reply');
    setForwardMessageId(null);
    setComposerMinimized(false);
  };

  const startForward = (messageId: string) => {
    setComposerMode('forward');
    setForwardMessageId(messageId);
    setComposerMinimized(false);
  };

  const recipients = () => to.split(/[,;\s]+/).filter(Boolean);

  const send = async () => {
    if (composerMode === 'new') {
      setIsSending(true);
      try {
        await request('/api/mail/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: recipients(), subject, html: draft }),
        });
        toast.success('Verstuurd', 'Je bericht is verstuurd');
        resetComposer();
        if (currentFolder?.kind === 'sent') loadList();
      } catch (error: any) {
        toast.error('Versturen mislukt', error.message);
      } finally {
        setIsSending(false);
      }
      return;
    }

    if (!selectedId) return;
    const id = encodeURIComponent(selectedId);

    setIsSending(true);
    try {
      if (composerMode === 'reply') {
        if (isRichTextEmpty(draft)) return;
        await request(`/api/mail/messages/${id}/reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: draft }),
        });
        toast.success('Verstuurd', 'Je antwoord is verstuurd');
      } else {
        await request(`/api/mail/messages/${id}/forward`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: forwardMessageId,
            to: recipients(),
            html: draft,
          }),
        });
        toast.success('Doorgestuurd', 'Het bericht is doorgestuurd');
      }

      resetComposer();
      setThread(await request(`/api/mail/messages/${id}`));
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
              ? 'De toegang tot je mailbox is verlopen of ingetrokken. Zet de koppeling opnieuw aan om je mail weer te zien.'
              : 'Koppel je Gmail- of Outlook-mailbox bij Instellingen > Plug-ins om je mail hier te lezen en te beantwoorden.'}
          </p>
          <Link href="/settings?tab=plugins" className="button">
            Naar Plug-ins
          </Link>
        </div>
      </Layout>
    );
  }

  const currentFolder = folders.find(f => f.id === folder);

  return (
    <Layout title="Inbox">
      <div className="inbox">
        <nav className="inbox-folders">
          <button type="button" className="button with-icon" onClick={startNew}>
            <SquarePen size={15} />
            Mail opstellen
          </button>

          {folders.length === 0
            ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height="1.75rem" style={{ marginBottom: 'var(--space5)' }} />)
            : folders.map(f => {
                const Icon = FOLDER_ICONS[f.kind];
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={!search && f.id === folder ? 'active' : ''}
                    onClick={() => chooseFolder(f.id)}
                  >
                    <Icon size={15} />
                    <span className="name">{f.name}</span>
                    {!!f.unread && f.kind !== 'sent' && f.kind !== 'drafts' && (
                      <span className="count">{f.unread}</span>
                    )}
                  </button>
                );
              })}
        </nav>

        <div className="inbox-list">
          <div className="list-header">
            <div className="title-row">
              <h1>{search ? 'Zoekresultaten' : currentFolder?.name || 'Inbox'}</h1>
              <div className="actions">
                <label className="toggle-label">
                  <Toggle label="Alleen ongelezen" checked={unreadOnly} onChange={setUnreadOnly} />
                  <span>Ongelezen</span>
                </label>
                <button
                  type="button"
                  className="button icon"
                  aria-label="Vernieuwen"
                  onClick={() => {
                    loadList();
                    loadFolders();
                  }}
                  disabled={isLoadingList}
                >
                  <RefreshCw size={15} />
                </button>
              </div>
            </div>

            <label className="search">
              <Search size={15} />
              <input
                type="search"
                value={searchInput}
                placeholder="Zoeken in je mail"
                aria-label="Zoeken in je mail"
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') setSearch(searchInput.trim());
                }}
              />
            </label>
          </div>

          {isLoadingList ? (
            <div className="list-loading">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} height="3.5rem" style={{ marginBottom: 'var(--space10)' }} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="list-empty">
              {search ? `Niets gevonden voor "${search}".` : unreadOnly ? 'Geen ongelezen mail.' : 'Deze map is leeg.'}
            </p>
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
          {composerMode === 'new' ? (
            <MailComposer
              mode="new"
              recipient={null}
              to={to}
              onToChange={setTo}
              subject={subject}
              onSubjectChange={setSubject}
              html={draft}
              onHtmlChange={setDraft}
              signature={signature}
              minimized={false}
              onMinimizedChange={() => {}}
              onClose={resetComposer}
              onDiscard={resetComposer}
              onSend={send}
              isSending={isSending}
            />
          ) : !selectedId ? (
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
            <>
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
                      <span className="message-actions">
                        <span className="meta">{timeAgo(message.date)}</span>
                        {/* Gmail kent een ster, Outlook een vlag; het werkt hetzelfde */}
                        <ToolButton
                          title={
                            account?.provider === 'microsoft'
                              ? message.starred ? 'Vlag weghalen' : 'Markeren met vlag'
                              : message.starred ? 'Ster weghalen' : 'Ster toevoegen'
                          }
                          className={message.starred ? 'starred' : undefined}
                          onClick={() => toggleStar(message.id, !message.starred)}
                        >
                          {account?.provider === 'microsoft' ? <Flag size={15} /> : <Star size={15} />}
                        </ToolButton>
                        <ToolButton title="Antwoorden" onClick={startReply}>
                          <Reply size={15} />
                        </ToolButton>
                        <ToolButton title="Doorsturen" onClick={() => startForward(message.id)}>
                          <Forward size={15} />
                        </ToolButton>
                      </span>
                    </div>
                    <MailBody html={message.html} />
                  </div>
                ))}
              </div>

              <MailComposer
                mode={composerMode}
                recipient={replyRecipient()}
                to={to}
                onToChange={setTo}
                subject={subject}
                onSubjectChange={setSubject}
                html={draft}
                onHtmlChange={setDraft}
                signature={signature}
                minimized={composerMinimized}
                onMinimizedChange={setComposerMinimized}
                onClose={resetComposer}
                onDiscard={resetComposer}
                onSend={send}
                isSending={isSending}
              />
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
