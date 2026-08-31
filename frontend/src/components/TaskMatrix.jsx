import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import api from '../api.js';
import { todayStr, formatDateTiny } from './DateNav.jsx';

// Выбранные задачи переживают перезагрузку страницы — иначе набор привычек,
// за которым следишь каждый день, приходится отмечать заново.
const STORAGE_KEY = 'analyticsTaskNorms';

// Строка матрицы определяется ключом «название#слот». Раньше сохранялось голое
// название — приводим такие записи к первому слоту, чтобы выбор не сбросился.
function migrateKey(key) {
  return typeof key === 'string' && !key.includes('#') ? `${key}#1` : key;
}

const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function dayMeta(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const wd = d.getUTCDay();
  return { num: d.getUTCDate(), weekday: WEEKDAY_SHORT[wd], weekend: wd === 0 || wd === 6 };
}

// Что показать в ячейке. Если в один день несколько задач с одним названием,
// выигрывает более «сильный» исход: выполнено > провалено > не отмечено > перенесено.
function cellState(cell) {
  if (!cell) return 'none';
  if (cell.done > 0) return 'done';
  if (cell.failed > 0) return 'failed';
  if (cell.pending > 0) return 'pending';
  if (cell.moved_away > 0) return 'moved';
  return 'none';
}

// pending и moved — оба «нейтральные» исходы, поэтому различаются не оттенком
// серого (на глаз почти неотличимо), а цветом: у moved свой жёлто-янтарный токен
// (--color-moved), pending остаётся серым. Акцентный фиолетовый сюда не берём —
// он зарезервирован под цвет будущей новой категории.
const CELL = {
  done: { className: 'bg-done', label: 'выполнено' },
  failed: { className: 'bg-clay', label: 'провалено' },
  pending: { className: 'bg-muted/50', label: 'не отмечено' },
  moved: { className: 'bg-moved', label: 'перенесено на другой день' },
  none: { className: 'bg-paper border border-line', label: 'задачи не было' },
};

// У названия, встречающегося в дне по нескольку раз, слоты различаются временем
// (а если времени нет — порядковым номером). У обычных задач подписи нет.
function slotLabel(task) {
  if (task.slot_count < 2) return null;
  return task.time_from || `#${task.slot}`;
}

function rowTitle(task) {
  const label = slotLabel(task);
  return label ? `${task.title} · ${label}` : task.title;
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 text-xs text-muted">
      {['done', 'failed', 'pending', 'moved', 'none'].map((key) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span className={`w-3 h-3 rounded-sm ${CELL[key].className}`} />
          {CELL[key].label}
        </span>
      ))}
    </div>
  );
}

export default function TaskMatrix({ from, to }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return new Set(Array.isArray(stored) ? stored.map(migrateKey) : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get('/analytics/by-task', { params: { from, to } })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || 'Не удалось загрузить данные');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
    } catch {
      /* приватный режим — просто не сохраняем */
    }
  }, [selected]);

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const available = data?.tasks || [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? available.filter((t) => t.norm.includes(q)) : available;
  }, [available, query]);

  // Порядок строк — как пришёл с бэкенда (сначала пункты типового расписания)
  const rows = available.filter((t) => selected.has(t.key));
  const dates = data?.dates || [];
  const today = todayStr();

  return (
    <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5">
      {loading ? (
        <p className="text-muted text-sm">Загрузка…</p>
      ) : error ? (
        <p className="text-sm text-clay">{error}</p>
      ) : available.length === 0 ? (
        <p className="text-muted text-sm">За выбранный период задач не было.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск задачи"
                className="w-full rounded-lg border border-line-strong bg-surface pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <button
              type="button"
              onClick={() => setSelected(new Set(available.filter((t) => t.in_template).map((t) => t.key)))}
              className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-paper transition"
            >
              Все из расписания
            </button>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-muted hover:text-ink hover:bg-paper transition"
              >
                Снять выбор
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto scrollbar-thin mb-4">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted py-1">Ничего не нашлось.</p>
            ) : (
              filtered.map((t) => {
                const active = selected.has(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => toggle(t.key)}
                    title={`${t.category_name} · дней: ${Object.keys(t.days).length}`}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                      active
                        ? 'border-accent bg-accent-light text-ink font-medium'
                        : 'border-line-strong text-muted hover:text-ink'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.category_color }} />
                    {t.title}
                    {slotLabel(t) && <span className="font-mono text-[10px] opacity-70">{slotLabel(t)}</span>}
                    {active && <X size={12} className="shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-muted">Отметьте задачи выше — покажем, в какие дни каждая была выполнена.</p>
          ) : (
            <>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-max border-separate border-spacing-0 text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-20 bg-surface border-r border-line text-left font-normal text-muted pr-2 pb-2 align-bottom">
                        <div className="w-28 sm:w-52">Задача</div>
                      </th>
                      {dates.map((date) => {
                        const m = dayMeta(date);
                        return (
                          <th
                            key={date}
                            className={`w-7 font-normal pb-2 align-bottom ${
                              m.weekend ? 'text-clay' : 'text-muted'
                            } ${date === today ? 'font-semibold text-accent' : ''}`}
                          >
                            <div className="leading-tight">{m.num}</div>
                            <div className="leading-tight text-[10px]">{m.weekday}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => {
                      // Знаменатель — сколько раз задача вообще была запланирована,
                      // включая дни, из которых её перенесли
                      const attempts = t.total + t.moved_away;
                      return (
                        <tr key={t.key}>
                          <th className="sticky left-0 z-10 bg-surface border-t border-r border-line text-left font-normal pr-2 py-1">
                            <div className="w-28 sm:w-52" title={rowTitle(t)}>
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: t.category_color }}
                                />
                                <span className="min-w-0 text-ink truncate">{t.title}</span>
                                {slotLabel(t) && (
                                  <span className="shrink-0 font-mono text-[10px] text-muted">{slotLabel(t)}</span>
                                )}
                              </span>
                              <span className="block pl-3.5 text-[10px] text-muted">
                                {t.done} из {attempts}
                                {attempts > 0 && ` · ${Math.round((t.done / attempts) * 100)}%`}
                              </span>
                            </div>
                          </th>
                          {dates.map((date) => {
                            const state = cellState(t.days[date]);
                            return (
                              <td key={date} className="py-1 border-t border-line">
                                <span
                                  title={`${formatDateTiny(date)} — ${CELL[state].label}`}
                                  className={`block w-5 h-5 mx-auto rounded-sm ${CELL[state].className}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Legend />
            </>
          )}
        </>
      )}
    </div>
  );
}
