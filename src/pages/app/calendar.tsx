import HelpButton from '@/components/HelpButton';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import Layout from '@/components/Layout';
import EventEditor from '@/components/EventEditor';
import Select from '@/components/Select';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import { useMailAccount } from '@/hooks/useMailAccount';
import type { CalendarEvent } from '@/lib/mail/types';

const DAY = 24 * 60 * 60 * 1000;

/** Hoeveel afspraken er in een vakje van de maand passen; de rest wordt "N meer". */
const MAX_PER_DAY = 3;

const WEEKDAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

type View = 'month' | 'week';

const VIEW_OPTIONS = [
  { value: 'month', label: 'Maandweergave' },
  { value: 'week', label: 'Weekweergave' },
];

// Welke weergave iemand het laatst koos, voor de volgende keer
const VIEW_KEY = 'synbased:calendar-view';

/** Maandag 00:00 van de week waarin deze datum valt. */
function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (start.getDay() + 6) % 7; // maandag = 0
  start.setDate(start.getDate() - weekday);
  return start;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Een datum zonder tijd (2026-10-14) hoort bij de eigen tijdzone, niet bij UTC. */
function parseMoment(value: string, allDay: boolean): Date {
  if (allDay) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const time = (date: Date) => date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
const shortDate = (date: Date) => date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Welke dagen er in beeld staan. Een maand begint op de maandag vóór de 1e
 * en loopt door tot de zondag na de laatste dag, zodat elke rij een hele week is.
 */
function visibleDays(view: View, anchor: Date): Date[] {
  if (view === 'week') {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }

  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const weeks = Math.ceil((Math.round((last.getTime() - start.getTime()) / DAY) + 1) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}

/**
 * De Agenda: de afspraken uit Google Agenda of de Outlook-agenda, per maand of
 * per week. Toevoegen, wijzigen en verwijderen gebeurt rechtstreeks in die
 * agenda, dus het staat ook meteen op je telefoon.
 */
export default function CalendarPage() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const account = useMailAccount();

  const [view, setView] = useState<View>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  // Het venster om een afspraak toe te voegen of te wijzigen
  const [editing, setEditing] = useState<{ event: CalendarEvent | null; day: Date } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_KEY);
      if (stored === 'month' || stored === 'week') setView(stored);
    } catch {
      // Zonder opslag begint de agenda gewoon op de maand
    }
  }, []);

  const chooseView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Dan geldt de keuze alleen voor nu
    }
  };

  const days = visibleDays(view, anchor);
  const rangeStart = days[0];
  const rangeEnd = addDays(days[days.length - 1], 1);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ from: rangeStart.toISOString(), to: rangeEnd.toISOString() });
      const response = await fetch(`/api/mail/events?${params}`);
      const data = await response.json().catch(() => ({}));

      if (response.status === 409 && data.reconnect) {
        setNeedsReconnect(true);
        return;
      }
      if (!response.ok) throw new Error(data.error || 'De agenda is niet bereikbaar');
      setEvents(data);
    } catch (error: any) {
      toast.error('Agenda', error.message);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart.getTime(), rangeEnd.getTime(), toast]);

  useEffect(() => {
    if (account) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, rangeStart.getTime(), rangeEnd.getTime()]);

  /** Een verzoek dat iets in de agenda verandert; een ontbrekende toestemming wordt apart herkend. */
  const change = async (url: string, init: RequestInit) => {
    const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
    const data = await response.json().catch(() => ({}));

    if (response.status === 409 && data.reconnect) {
      setEditing(null);
      setNeedsReconnect(true);
      throw new Error(data.error);
    }
    if (!response.ok) throw new Error(data.error || 'Er is iets misgegaan');
  };

  const save = async (input: Record<string, unknown>) => {
    if (!editing) return;

    setIsSaving(true);
    try {
      if (editing.event) {
        await change(`/api/mail/events/${encodeURIComponent(editing.event.id)}`, { method: 'PATCH', body: JSON.stringify(input) });
        toast.success('Opgeslagen', 'De afspraak is gewijzigd');
      } else {
        await change('/api/mail/events', { method: 'POST', body: JSON.stringify(input) });
        toast.success('Toegevoegd', 'De afspraak staat in je agenda');
      }
      setEditing(null);
      load();
    } catch (error: any) {
      toast.error('Opslaan mislukt', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    const event = editing?.event;
    if (!event) return;

    const confirmed = await confirm({
      title: 'Afspraak verwijderen',
      message: `"${event.title}" wordt uit je agenda verwijderd.`,
      confirmText: 'Verwijderen',
      negative: true,
      cancelText: 'Annuleren',
    });
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await change(`/api/mail/events/${encodeURIComponent(event.id)}`, { method: 'DELETE' });
      toast.success('Verwijderd', 'De afspraak is uit je agenda gehaald');
      setEditing(null);
      load();
    } catch (error: any) {
      toast.error('Verwijderen mislukt', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (account === null || needsReconnect) {
    return (
      <Layout title="Agenda">
        <div className="empty-state">
          <h2>{needsReconnect ? 'Geef Synbased toegang tot je agenda' : 'Agenda staat nog uit'}</h2>
          <p>
            {needsReconnect
              ? 'Je koppeling mist nog toegang tot je agenda, of de toegang is verlopen. Verwijder de koppeling bij Plug-ins en installeer hem opnieuw; geef daarbij toegang tot je agenda.'
              : 'Koppel je Google- of Microsoft-account bij Instellingen > Plug-ins om je afspraken hier te zien.'}
          </p>
          <Link href="/app/settings?tab=plugins" className="button">
            Naar Plug-ins
          </Link>
        </div>
      </Layout>
    );
  }

  const today = new Date();

  /** Een maand of een week verder of terug. */
  const step = (direction: 1 | -1) => {
    setAnchor(current =>
      view === 'month'
        ? new Date(current.getFullYear(), current.getMonth() + direction, 1)
        : addDays(current, direction * 7)
    );
  };

  /** De afspraken die (deels) op deze dag vallen: hele dagen eerst, dan op tijd. */
  const eventsOn = (day: Date) =>
    events
      .filter(event => {
        const start = parseMoment(event.start, event.allDay).getTime();
        const end = parseMoment(event.end, event.allDay).getTime();
        return start < day.getTime() + DAY && end > day.getTime();
      })
      .sort(
        (a, b) =>
          Number(b.allDay) - Number(a.allDay) ||
          parseMoment(a.start, a.allDay).getTime() - parseMoment(b.start, b.allDay).getTime()
      );

  const title =
    view === 'month'
      ? capitalize(anchor.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }))
      : `Week ${capitalize(days[0].toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' }))}`;

  // In de maand telt het bereik van de maand zelf, niet de randdagen ervoor en erna
  const subtitle =
    view === 'month'
      ? `${shortDate(new Date(anchor.getFullYear(), anchor.getMonth(), 1))} – ${shortDate(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0))}`
      : `${shortDate(days[0])} – ${shortDate(days[6])}`;

  return (
    <Layout title="Agenda">
      <div className="header">
        <h1>Agenda <HelpButton topic="calendar" /></h1>
      </div>

      <div className="block calendar">
        <div className="calendar-toolbar">
          <div className="calendar-heading">
            <span className="date-badge" aria-label={`Vandaag, ${today.toLocaleDateString('nl-NL')}`}>
              <span className="month">{today.toLocaleDateString('nl-NL', { month: 'short' }).replace('.', '')}</span>
              <span className="day">{today.getDate()}</span>
            </span>
            <span>
              <h2>{title}</h2>
              <span className="description">{subtitle}</span>
            </span>
          </div>

          <div className="actions">
            <div className="button-group">
              <button
                type="button"
                className="button icon"
                aria-label={view === 'month' ? 'Vorige maand' : 'Vorige week'}
                onClick={() => step(-1)}
              >
                <ArrowLeft size={16} />
              </button>
              <button type="button" className="button cancel" onClick={() => setAnchor(new Date())}>
                Vandaag
              </button>
              <button
                type="button"
                className="button icon"
                aria-label={view === 'month' ? 'Volgende maand' : 'Volgende week'}
                onClick={() => step(1)}
              >
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="view-select">
              <Select
                value={VIEW_OPTIONS.find(o => o.value === view) || null}
                onChange={(option) => chooseView((option?.value as View) || 'month')}
                options={VIEW_OPTIONS}
              />
            </div>

            <button
              type="button"
              className="button with-icon"
              onClick={() => {
                // Vandaag als die in beeld staat, anders de eerste dag die je ziet
                const day = days.some(d => sameDay(d, today)) ? today : view === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) : days[0];
                setEditing({ event: null, day });
              }}
            >
              <Plus size={15} />
              Afspraak toevoegen
            </button>
          </div>
        </div>

        <div className={`calendar-grid ${view}`}>
          {WEEKDAYS.map(weekday => (
            <div key={weekday} className="calendar-weekday">
              {weekday}
            </div>
          ))}

          {days.map(day => {
            const dayEvents = eventsOn(day);
            const outside = view === 'month' && day.getMonth() !== anchor.getMonth();
            const shown = view === 'month' ? dayEvents.slice(0, MAX_PER_DAY) : dayEvents;
            const hidden = dayEvents.length - shown.length;

            return (
              <div
                key={day.toISOString()}
                className={`calendar-cell${outside ? ' outside' : ''}${sameDay(day, today) ? ' today' : ''}`}
                // Een klik op een leeg stuk van de dag maakt daar een afspraak
                onClick={() => setEditing({ event: null, day })}
              >
                <span className="day-number">{day.getDate()}</span>

                {isLoading ? (
                  <Skeleton height="1.5rem" />
                ) : (
                  <>
                    {shown.map(event => {
                      const start = parseMoment(event.start, event.allDay);
                      const end = parseMoment(event.end, event.allDay);

                      return (
                        <button
                          key={event.id}
                          type="button"
                          className={`calendar-chip${event.allDay ? ' all-day' : ''}`}
                          title={event.location ? `${event.title} – ${event.location}` : event.title}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing({ event, day });
                          }}
                        >
                          <span className="title">{event.title}</span>
                          {!event.allDay && (
                            <span className="time">
                              {view === 'week'
                                ? `${sameDay(start, day) ? time(start) : '...'} – ${sameDay(end, day) ? time(end) : '...'}`
                                : sameDay(start, day) ? time(start) : '...'}
                            </span>
                          )}
                          {view === 'week' && event.location && <span className="location">{event.location}</span>}
                        </button>
                      );
                    })}

                    {hidden > 0 && (
                      <button
                        type="button"
                        className="calendar-more"
                        onClick={(e) => {
                          // Naar de week van deze dag, waar alles past
                          e.stopPropagation();
                          setAnchor(day);
                          chooseView('week');
                        }}
                      >
                        {hidden} meer...
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {editing && (
        <EventEditor
          event={editing.event}
          day={editing.day}
          isSaving={isSaving}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
    </Layout>
  );
}
