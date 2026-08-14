import React from 'react';
import { List, CalendarDays } from 'lucide-react';

// Переключатель отображения раздела «Со временем»: список или календарь.
export default function TimedViewToggle({ value, onChange }) {
  const btn = (v, Icon, label) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      title={label}
      aria-label={label}
      aria-pressed={value === v}
      className={`px-2 py-1 flex items-center transition ${v !== 'list' ? 'border-l border-line-strong' : ''} ${
        value === v ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
      }`}
    >
      <Icon size={15} />
    </button>
  );

  return (
    <div className="inline-flex rounded-lg border border-line-strong overflow-hidden">
      {btn('list', List, 'Списком')}
      {btn('calendar', CalendarDays, 'Календарём')}
    </div>
  );
}
