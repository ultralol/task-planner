// Возвращает 'weekday' или 'weekend' для строки даты формата YYYY-MM-DD
function templateTypeForDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay(); // 0 = воскресенье, 6 = суббота
  return day === 0 || day === 6 ? 'weekend' : 'weekday';
}

function isValidDateStr(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

// Сдвиг строки даты на n дней. Считаем в UTC, чтобы результат не зависел
// от часового пояса сервера и перехода на летнее время.
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Все даты диапазона включительно: ['2026-08-01', '2026-08-02', ...]
function dateRange(from, to) {
  const out = [];
  for (let cur = from; cur <= to; cur = addDays(cur, 1)) out.push(cur);
  return out;
}

module.exports = { templateTypeForDate, isValidDateStr, addDays, dateRange };
