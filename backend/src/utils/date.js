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

module.exports = { templateTypeForDate, isValidDateStr };
