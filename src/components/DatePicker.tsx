import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
}

const MONTHS = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

/** Aantal jaren dat het jaaroverzicht in één keer toont. */
const YEARS_PER_PAGE = 12;

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Selecteer datum...',
  isDisabled = false
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  // Klikken op de maandnaam schakelt naar maanden en daarna naar jaren, zodat
  // een geboortedatum in drie klikken te bereiken is in plaats van jaren terugbladeren
  const [view, setView] = useState<'days' | 'months' | 'years'>('days');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Initialize currentMonth based on value
  useEffect(() => {
    if (value) {
      setCurrentMonth(new Date(value));
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setView('days');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];

    // Add empty slots for days before the first day of the month (Monday = 0)
    for (let i = 0; i < (startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1); i++) {
      days.push(null);
    }

    // Add all days in the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const handleDateClick = (day: number) => {
    const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const formattedDate = selectedDate.toISOString().split('T')[0];
    onChange(formattedDate);
    setIsOpen(false);
    setView('days');
  };

  const handleMonthClick = (month: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), month, 1));
    setView('days');
  };

  const handleYearClick = (year: number) => {
    setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
    setView('months');
  };

  // De pijltjes verspringen een maand, een jaar of een heel jaarblok,
  // afhankelijk van wat er open staat
  const step = (direction: -1 | 1) => {
    if (view === 'days') {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1));
    } else if (view === 'months') {
      setCurrentMonth(new Date(currentMonth.getFullYear() + direction, currentMonth.getMonth(), 1));
    } else {
      setCurrentMonth(
        new Date(currentMonth.getFullYear() + direction * YEARS_PER_PAGE, currentMonth.getMonth(), 1)
      );
    }
  };

  const days = getDaysInMonth(currentMonth);
  const today = new Date().toISOString().split('T')[0];
  const selectedDate = value ? new Date(value) : null;
  const selectedDay = selectedDate ? selectedDate.getDate() : null;
  const isCurrentMonth = selectedDate &&
    selectedDate.getMonth() === currentMonth.getMonth() &&
    selectedDate.getFullYear() === currentMonth.getFullYear();

  // Het jaarblok begint op een rond getal, zodat bladeren voorspelbaar loopt
  const firstYear = Math.floor(currentMonth.getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE;
  const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => firstYear + i);

  const headerLabel =
    view === 'days'
      ? `${MONTHS[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`
      : view === 'months'
        ? String(currentMonth.getFullYear())
        : `${firstYear} - ${firstYear + YEARS_PER_PAGE - 1}`;

  return (
    <div className="datepicker" ref={pickerRef}>
      <div
        className="control"
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        style={{ opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer' }}
      >
        <div className="value">
          {value ? formatDate(value) : <span style={{ color: 'var(--font-color2)' }}>{placeholder}</span>}
        </div>
        <div className="arrow">
          <Calendar size={16} />
        </div>
      </div>

      {isOpen && !isDisabled && (
        <div className="menu">
          <div className="header">
            <button type="button" onClick={() => step(-1)} className="nav">
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="month"
              onClick={() => setView(view === 'days' ? 'months' : view === 'months' ? 'years' : 'days')}
            >
              {headerLabel}
            </button>
            <button type="button" onClick={() => step(1)} className="nav">
              <ChevronRight size={16} />
            </button>
          </div>

          {view === 'days' && (
            <>
              <div className="weekdays">
                {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((day) => (
                  <div key={day} className="weekday">{day}</div>
                ))}
              </div>

              <div className="days">
                {days.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} className="day empty"></div>;
                  }

                  const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0];
                  const isToday = dateStr === today;
                  const isSelected = isCurrentMonth && day === selectedDay;

                  return (
                    <button
                      key={day}
                      type="button"
                      className={`day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleDateClick(day)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === 'months' && (
            <div className="days" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {MONTHS.map((month, index) => (
                <button
                  key={month}
                  type="button"
                  className={`day ${index === currentMonth.getMonth() ? 'selected' : ''}`}
                  onClick={() => handleMonthClick(index)}
                >
                  {month.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          {view === 'years' && (
            <div className="days" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  className={`day ${year === currentMonth.getFullYear() ? 'selected' : ''}`}
                  onClick={() => handleYearClick(year)}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
