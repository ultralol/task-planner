import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

// Дата в формате YYYY-MM-DD по ЛОКАЛЬНОМУ времени пользователя (не UTC),
// иначе рядом с полуночью «сегодня» определяется неверно (зона +3).
export function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

export function formatDateHuman(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

// DD MMM YYYY на русском, например «13 авг 2026»
export function formatDateShort(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${dd} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function todayStr() {
  return toLocalDateStr(new Date());
}

// Кнопка с датой (DD MMM YYYY), открывающая нативный date-picker по клику.
export function DateButton({ value, onChange, min, className = 'rounded-lg border border-line-strong' }) {
  const inputRef = useRef(null);

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        /* showPicker может бросить вне пользовательского жеста — падаем на focus */
      }
    }
    el.focus();
  }

  return (
    <button
      type="button"
      onClick={openPicker}
      className={`relative bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper transition ${className}`}
    >
      {formatDateShort(value)}
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="absolute inset-0 opacity-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />
    </button>
  );
}

// Переключатель даты: ‹ дата › со стрелками на день назад/вперёд.
// Единый вид для всех выборов даты в приложении.
export function DateStepper({ value, onChange, min }) {
  const prevDisabled = Boolean(min) && shiftDate(value, -1) < min;

  return (
    <div className="inline-flex items-stretch rounded-lg border border-line-strong bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(shiftDate(value, -1))}
        disabled={prevDisabled}
        className="px-2 flex items-center text-muted hover:bg-paper hover:text-ink transition disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
        aria-label="Предыдущий день"
      >
        <ChevronLeft size={18} />
      </button>

      <DateButton value={value} onChange={onChange} min={min} className="border-x border-line-strong" />

      <button
        type="button"
        onClick={() => onChange(shiftDate(value, 1))}
        className="px-2 flex items-center text-muted hover:bg-paper hover:text-ink transition"
        aria-label="Следующий день"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export default function DateNav({ date, onChange }) {
  const isToday = date === todayStr();

  return (
    <div className="flex items-center gap-2 mb-1">
      <DateStepper value={date} onChange={onChange} />
      {!isToday && (
        <button
          type="button"
          onClick={() => onChange(todayStr())}
          title="Перейти к сегодняшнему дню"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-accent hover:bg-paper transition"
        >
          <CalendarDays size={15} />
          К сегодня
        </button>
      )}
    </div>
  );
}
