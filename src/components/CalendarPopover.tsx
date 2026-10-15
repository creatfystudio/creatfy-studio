import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { startOfDay } from '../lib/utils';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  datesWithOrders: Set<string>;
  initialMonth?: Date;
  onPickDay: (day: Date) => void;
  onPickRange: (start: Date, end: Date) => void;
  onClose: () => void;
}

export default function CalendarPopover({ datesWithOrders, initialMonth, onPickDay, onPickRange, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(() => initialMonth ?? new Date());
  const [rangeStart, setRangeStart] = useState<Date | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d));

  function handleDayClick(day: Date) {
    if (!rangeStart) {
      setRangeStart(day);
      onPickDay(day);
      return;
    }
    if (startOfDay(day).getTime() === startOfDay(rangeStart).getTime()) {
      setRangeStart(null);
      return;
    }
    const start = rangeStart < day ? rangeStart : day;
    const end = rangeStart < day ? day : rangeStart;
    onPickRange(start, end);
    setRangeStart(null);
  }

  return (
    <div className="calendar-popover" ref={ref}>
      <div className="row space-between" style={{ marginBottom: 10 }}>
        <button className="btn btn-icon btn-ghost btn-sm" onClick={() => setMonth(new Date(year, m - 1, 1))} aria-label="Mês anterior">
          <ChevronLeft size={16} />
        </button>
        <strong style={{ textTransform: 'capitalize' }}>
          {month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </strong>
        <button className="btn btn-icon btn-ghost btn-sm" onClick={() => setMonth(new Date(year, m + 1, 1))} aria-label="Próximo mês">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="calendar-grid" style={{ marginBottom: 6 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-sm text-muted" style={{ fontWeight: 700 }}>
            {w}
          </div>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map((day, i) =>
          day ? (
            <button
              key={i}
              type="button"
              className={`calendar-day ${datesWithOrders.has(dateKey(day)) ? 'has-orders' : ''} ${
                rangeStart && dateKey(rangeStart) === dateKey(day) ? 'selected' : ''
              }`}
              onClick={() => handleDayClick(day)}
            >
              {day.getDate()}
            </button>
          ) : (
            <div key={i} />
          )
        )}
      </div>
      <p className="text-sm text-muted" style={{ marginTop: 10 }}>
        Clique em um dia para filtrar só aquele dia, ou clique em dois dias para escolher um período.
      </p>
    </div>
  );
}
