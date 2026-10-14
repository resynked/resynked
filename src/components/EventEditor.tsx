import { useState } from 'react';
import Modal from '@/components/Modal';
import DatePicker from '@/components/DatePicker';
import Toggle from '@/components/Toggle';
import { datumNaarTekst, tekstNaarDatum } from '@/lib/utils';
import type { CalendarEvent } from '@/lib/mail/types';

interface EventEditorProps {
  /** Een bestaande afspraak om te wijzigen; zonder is het een nieuwe */
  event: CalendarEvent | null;
  /** Voor een nieuwe afspraak: de dag waar je op klikte */
  day: Date;
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: Record<string, unknown>) => void;
  onDelete: () => void;
}

const pad = (value: number) => String(value).padStart(2, '0');
const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

function addDays(value: string, days: number): string {
  const date = tekstNaarDatum(value);
  date.setDate(date.getDate() + days);
  return datumNaarTekst(date);
}

/** De velden zoals ze in het formulier staan, uit een afspraak of voor een lege dag. */
function initialForm(event: CalendarEvent | null, day: Date) {
  if (!event) {
    const date = datumNaarTekst(day);
    return { title: '', allDay: false, startDate: date, startTime: '09:00', endDate: date, endTime: '10:00', location: '', description: '' };
  }

  if (event.allDay) {
    // Bij een hele dag geeft de agenda de dag ná de laatste dag; wij tonen de laatste dag zelf
    return {
      title: event.title,
      allDay: true,
      startDate: event.start.slice(0, 10),
      startTime: '09:00',
      endDate: addDays(event.end.slice(0, 10), -1),
      endTime: '10:00',
      location: event.location,
      description: event.description,
    };
  }

  const start = new Date(event.start);
  const end = new Date(event.end);
  return {
    title: event.title,
    allDay: false,
    startDate: datumNaarTekst(start),
    startTime: clock(start),
    endDate: datumNaarTekst(end),
    endTime: clock(end),
    location: event.location,
    description: event.description,
  };
}

/**
 * Een afspraak toevoegen of wijzigen. Hij komt rechtstreeks in Google Agenda
 * of de Outlook-agenda te staan.
 */
export default function EventEditor({ event, day, isSaving, onClose, onSave, onDelete }: EventEditorProps) {
  const [form, setForm] = useState(() => initialForm(event, day));
  const set = (changes: Partial<typeof form>) => setForm(current => ({ ...current, ...changes }));

  // Schuift het begin voorbij het einde, dan schuift het einde mee
  const setStart = (changes: { startDate?: string; startTime?: string }) => {
    const next = { ...form, ...changes };
    if (`${next.endDate}T${next.endTime}` <= `${next.startDate}T${next.startTime}`) {
      const end = new Date(`${next.startDate}T${next.startTime}`);
      end.setHours(end.getHours() + 1);
      next.endDate = datumNaarTekst(end);
      next.endTime = clock(end);
    }
    if (next.allDay && next.endDate < next.startDate) next.endDate = next.startDate;
    setForm(next);
  };

  const save = () => {
    onSave({
      title: form.title,
      allDay: form.allDay,
      start: form.allDay ? form.startDate : new Date(`${form.startDate}T${form.startTime}`).toISOString(),
      // Een hele dag loopt tot de dag erna, zo rekenen Google en Outlook
      end: form.allDay ? addDays(form.endDate, 1) : new Date(`${form.endDate}T${form.endTime}`).toISOString(),
      location: form.location,
      // Alleen meesturen als hij veranderd is: in Outlook staat er soms een
      // opgemaakte uitnodiging in, met bijvoorbeeld een Teams-link
      ...(form.description !== (event?.description ?? '') ? { description: form.description } : {}),
    });
  };

  return (
    <Modal isOpen onClose={onClose} title={event ? 'Afspraak wijzigen' : 'Afspraak toevoegen'}>
      <div className="form-section">
        <div className="form-group">
          <label htmlFor="event_title">Titel</label>
          <input
            id="event_title"
            type="text"
            value={form.title}
            autoFocus
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Bijvoorbeeld: Opname bij klant"
          />
        </div>

        <label className="toggle-label">
          <Toggle label="Hele dag" checked={form.allDay} onChange={(allDay) => set({ allDay })} />
          <span>Hele dag</span>
        </label>

        <div className="form-row">
          <div className="form-group">
            <label>Begin</label>
            <DatePicker value={form.startDate} onChange={(startDate) => setStart({ startDate })} />
          </div>
          {!form.allDay && (
            <div className="form-group">
              <label htmlFor="event_start_time">Tijd</label>
              <input
                id="event_start_time"
                type="time"
                value={form.startTime}
                onChange={(e) => setStart({ startTime: e.target.value })}
              />
            </div>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Einde</label>
            <DatePicker value={form.endDate} onChange={(endDate) => set({ endDate })} />
          </div>
          {!form.allDay && (
            <div className="form-group">
              <label htmlFor="event_end_time">Tijd</label>
              <input
                id="event_end_time"
                type="time"
                value={form.endTime}
                onChange={(e) => set({ endTime: e.target.value })}
              />
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="event_location">Locatie</label>
          <input
            id="event_location"
            type="text"
            value={form.location}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="Adres of plaats"
          />
        </div>

        <div className="form-group">
          <label htmlFor="event_description">Omschrijving</label>
          <textarea
            id="event_description"
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </div>
      </div>

      <div className="buttons">
        {event?.url && (
          <a className="button cancel" href={event.url} target="_blank" rel="noreferrer">
            Openen in agenda
          </a>
        )}
        {event && (
          <button type="button" className="button negative" disabled={isSaving} onClick={onDelete}>
            Verwijderen
          </button>
        )}
        <button type="button" className="button cancel" onClick={onClose}>
          Annuleren
        </button>
        <button type="button" className="button" disabled={isSaving || !form.title.trim()} onClick={save}>
          {isSaving ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>
    </Modal>
  );
}
