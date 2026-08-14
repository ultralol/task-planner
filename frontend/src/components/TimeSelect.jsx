import React from 'react';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

// HH:MM, 24-часовой формат, минуты с шагом 15 — независимо от локали браузера.
// Значение необязательное: пустой час («--») означает «время не задано», onChange('').
export default function TimeSelect({ value, onChange }) {
  const [rawH, rawM] = (value || '').split(':');
  const hour = HOURS.includes(rawH) ? rawH : '';
  const minute = MINUTES.includes(rawM) ? rawM : '00';

  function setHour(nh) {
    if (!nh) return onChange('');
    onChange(`${nh}:${minute}`);
  }
  function setMinute(nm) {
    if (!hour) return;
    onChange(`${hour}:${nm}`);
  }

  const selectCls =
    'border border-line rounded-lg px-2 py-2 bg-surface focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50';

  return (
    <div className="flex items-center gap-1.5">
      <select value={hour} onChange={(e) => setHour(e.target.value)} className={selectCls}>
        <option value="">--</option>
        {HOURS.map((hh) => (
          <option key={hh} value={hh}>
            {hh}
          </option>
        ))}
      </select>
      <span className="text-muted">:</span>
      <select value={minute} onChange={(e) => setMinute(e.target.value)} disabled={!hour} className={selectCls}>
        {MINUTES.map((mm) => (
          <option key={mm} value={mm}>
            {mm}
          </option>
        ))}
      </select>
    </div>
  );
}
