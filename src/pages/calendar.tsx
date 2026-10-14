import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ExternalLink, MapPin } from 'lucide-react';
import Layout from '@/components/Layout';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useMailAccount } from '@/hooks/useMailAccount';
import type { CalendarEvent } from '@/lib/mail/types';

const DAY = 24 * 60 * 60 * 1000;

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

/** "13 – 19 oktober 2026", of over twee maanden "29 september – 5 oktober 2026". */
function weekLabel(start: Date): string {
  const end = addDays(start, 6);
  const month = (date: Date) => date.toLocaleDateString('nl-NL', { month: 'long' });

  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} ${month(end)} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)} ${end.getFullYear()}`;
}

/**
 * De Agenda: de afspraken uit Google Agenda of de Outlook-agenda, per week.
 * Alleen bekijken; afspraken maken en wijzigen gebeurt in de agenda zelf, via
 * de link bij elke afspraak.
 */
export default function CalendarPage() {
  const toast = useToast();
  const account = useMailAccount();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [needsReconnect, setNeedsReconnect] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ from: weekStart.toISOString(), to: addDays(weekStart, 7).toISOString() });
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
  }, [weekStart, toast]);

  useEffect(() => {
    if (account) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, weekStart]);

  if (account === null || needsReconnect) {
    return (
      <Layout title="Agenda">
        <div className="empty-state">
          <h2>{needsReconnect ? 'Geef Resynked toegang tot je agenda' : 'Agenda staat nog uit'}</h2>
          <p>
            {needsReconnect
              ? 'Je koppeling is van vóór de Agenda, of de toegang is verlopen. Zet de koppeling bij Plug-ins uit en weer aan om je afspraken hier te zien.'
              : 'Koppel je Google- of Microsoft-account bij Instellingen > Plug-ins om je afspraken hier te zien.'}
          </p>
          <Link href="/settings?tab=plugins" className="button">
            Naar Plug-ins
          </Link>
        </div>
      </Layout>
    );
  }

  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  /** De afspraken die (deels) op deze dag vallen; de hele-dag-afspraken eerst. */
  const eventsOn = (day: Date) =>
    events
      .filter(event => {
        const start = parseMoment(event.start, event.allDay).getTime();
        const end = parseMoment(event.end, event.allDay).getTime();
        return start < day.getTime() + DAY && end > day.getTime();
      })
      .sort((a, b) => Number(b.allDay) - Number(a.allDay));

  return (
    <Layout title="Agenda">
      <div className="header">
        <h1>Agenda</h1>
        <div className="actions">
          <button
            type="button"
            className="button icon"
            aria-label="Vorige week"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="button cancel" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Vandaag
          </button>
          <button
            type="button"
            className="button icon"
            aria-label="Volgende week"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="block calendar">
        <h2>{weekLabel(weekStart)}</h2>

        {days.map(day => {
          const dayEvents = eventsOn(day);

          return (
            <div key={day.toISOString()} className={`calendar-day${sameDay(day, today) ? ' today' : ''}`}>
              <div className="calendar-date">
                <span className="weekday">{day.toLocaleDateString('nl-NL', { weekday: 'short' })}</span>
                <span className="day">{day.getDate()}</span>
              </div>

              <div className="calendar-events">
                {isLoading ? (
                  <Skeleton height="2.25rem" />
                ) : dayEvents.length === 0 ? (
                  <span className="calendar-empty">Geen afspraken</span>
                ) : (
                  dayEvents.map(event => {
                    const start = parseMoment(event.start, event.allDay);
                    const end = parseMoment(event.end, event.allDay);

                    return (
                      <div key={`${event.id}-${day.getDate()}`} className="calendar-event">
                        <span className="time">
                          {event.allDay
                            ? 'Hele dag'
                            : `${sameDay(start, day) ? time(start) : '...'} – ${sameDay(end, day) ? time(end) : '...'}`}
                        </span>
                        <span className="information">
                          <span className="title">{event.title}</span>
                          {event.location && (
                            <span className="description">
                              <MapPin size={12} /> {event.location}
                            </span>
                          )}
                        </span>
                        {event.url && (
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Openen in ${account?.provider === 'microsoft' ? 'Outlook' : 'Google Agenda'}`}
                          >
                            <ExternalLink size={15} />
                          </a>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
