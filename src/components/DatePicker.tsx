import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Selecteer datum...',
  isDisabled = false
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
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
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const monthName = currentMonth.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
  const days = getDaysInMonth(currentMonth);
  const today = new Date().toISOString().split('T')[0];
  const selectedDay = value ? new Date(value).getDate() : null;
  const isCurrentMonth = value &&
    new Date(value).getMonth() === currentMonth.getMonth() &&
    new Date(value).getFullYear() === currentMonth.getFullYear();

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
            <button type="button" onClick={handlePrevMonth} className="nav">
              <ChevronLeft size={16} />
            </button>
            <div className="month">{monthName}</div>
            <button type="button" onClick={handleNextMonth} className="nav">
              <ChevronRight size={16} />
            </button>
          </div>

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
        </div>
      )}
    </div>
  );
}
