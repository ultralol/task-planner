const express = require('express');
const { pool } = require('../db');
const { auth } = require('../middleware/auth');
const { isValidDateStr, dateRange } = require('../utils/date');

const router = express.Router();
router.use(auth);

// Максимальная длина диапазона для отчётов по дням — иначе ответ разрастается
// до тысяч точек, а график/таблицу всё равно невозможно смотреть.
const MAX_RANGE_DAYS = 366;

router.get('/', async (req, res, next) => {
  const { from, to, category_id } = req.query;
  if (!isValidDateStr(from) || !isValidDateStr(to)) {
    return res.status(400).json({ error: 'Параметры from и to обязательны в формате YYYY-MM-DD' });
  }
  const dates = dateRange(from, to);
  if (dates.length > MAX_RANGE_DAYS) {
    return res.status(400).json({ error: `Слишком большой период: максимум ${MAX_RANGE_DAYS} дней` });
  }
  const categoryId = category_id ? Number(category_id) : null;

  try {
    // Задачи, находящиеся (сейчас) в днях диапазона
    const tasksInRange = await pool.query(
      `SELECT t.id, t.status, t.category_id, c.name AS category_name, c.color AS category_color, d.date
       FROM tasks t
       JOIN days d ON d.id = t.day_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1 AND d.date BETWEEN $2 AND $3
         AND ($4::int IS NULL OR t.category_id = $4)`,
      [req.userId, from, to, categoryId]
    );

    // Переносы, у которых исходный день попадает в диапазон (независимо от того, куда перенесли)
    const movesInRange = await pool.query(
      `SELECT tm.id, tm.task_id, t.category_id, c.name AS category_name, c.color AS category_color, d1.date AS from_date
       FROM task_moves tm
       JOIN tasks t ON t.id = tm.task_id
       JOIN days d1 ON d1.id = tm.from_day_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE tm.user_id = $1 AND d1.date BETWEEN $2 AND $3
         AND ($4::int IS NULL OR t.category_id = $4)`,
      [req.userId, from, to, categoryId]
    );

    const tasks = tasksInRange.rows;
    const moves = movesInRange.rows;

    const summary = {
      total: tasks.length,
      done: tasks.filter((t) => t.status === 'done').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      moved_away: moves.length,
    };
    summary.completion_rate = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;

    const byDayMap = new Map();
    const ensureDay = (date) => {
      if (!byDayMap.has(date)) {
        byDayMap.set(date, { date, total: 0, done: 0, failed: 0, pending: 0, moved_away: 0 });
      }
      return byDayMap.get(date);
    };
    // Каждый день диапазона должен попасть в ответ, даже если в нём нет задач
    // (либо их не было вообще, либо все отфильтрованы по категории) — иначе
    // такой день пропадает из графика вместо того, чтобы показать ноль.
    for (const d of dates) ensureDay(d);
    for (const t of tasks) {
      const entry = ensureDay(t.date instanceof Date ? t.date.toISOString().slice(0, 10) : t.date);
      entry.total += 1;
      entry[t.status] += 1;
    }
    for (const m of moves) {
      const dateStr = m.from_date instanceof Date ? m.from_date.toISOString().slice(0, 10) : m.from_date;
      const entry = ensureDay(dateStr);
      entry.moved_away += 1;
    }
    const byDay = Array.from(byDayMap.values()).sort((a, b) => (a.date < b.date ? -1 : 1));

    const byCategoryMap = new Map();
    const ensureCategory = (id, name, color) => {
      const key = id || 'none';
      if (!byCategoryMap.has(key)) {
        byCategoryMap.set(key, {
          category_id: id,
          category_name: name || 'Без категории',
          category_color: color || '#94a3b8',
          total: 0,
          done: 0,
          failed: 0,
          pending: 0,
          moved_away: 0,
        });
      }
      return byCategoryMap.get(key);
    };
    for (const t of tasks) {
      const entry = ensureCategory(t.category_id, t.category_name, t.category_color);
      entry.total += 1;
      entry[t.status] += 1;
    }
    for (const m of moves) {
      const entry = ensureCategory(m.category_id, m.category_name, m.category_color);
      entry.moved_away += 1;
    }
    const byCategory = Array.from(byCategoryMap.values());

    res.json({ summary, by_day: byDay, by_category: byCategory });
  } catch (err) {
    next(err);
  }
});

// Нормализация названия: одинаковыми считаются задачи с совпадающим названием
// без учёта регистра и пробелов по краям. Ровно так же шаблон узнаёт «свои»
// задачи в дне (см. utils/days.js: generateFromTemplate, skipExistingTitles) —
// прямой ссылки tasks -> template_items в схеме нет.
const NORM = `lower(btrim(t.title))`;

// Слот — порядковый номер задачи среди одноимённых В ПРЕДЕЛАХ ОДНОГО ДНЯ.
// Название делится на несколько строк матрицы только если встречается в дне
// больше одного раза: «Рабочее время» 09:00 и 14:00 — это две разные задачи.
// А «Витамины утром» в 08:30 по будням и в 09:00 по выходным — одна и та же
// привычка, поэтому делить просто по времени нельзя.
const SLOT = `row_number() OVER (
         PARTITION BY t.day_id, ${NORM}
         ORDER BY t.time_from NULLS LAST, t.sort_order, t.id
       )`;

const timeToMin = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// Куда отнести перенесённую задачу: её строки в исходном дне уже нет, поэтому
// слот по нему не посчитать. Берём слот с ближайшим временем; если времени нет —
// слот тоже без времени, иначе первый.
function nearestSlot(slotTimes, time) {
  const slots = [...slotTimes.keys()].sort((a, b) => a - b);
  if (slots.length === 0) return 1;
  if (slots.length === 1) return slots[0];
  const target = timeToMin(time);
  let best = slots[0];
  let bestDist = Infinity;
  for (const slot of slots) {
    const value = timeToMin(slotTimes.get(slot));
    const dist = target === null || value === null ? (target === value ? 0 : Infinity) : Math.abs(value - target);
    if (dist < bestDist) {
      best = slot;
      bestDist = dist;
    }
  }
  return best;
}

// Выполнение конкретных задач по дням: для каждой задачи — что было в каждый
// день диапазона (выполнено / не выполнено / перенесено на другой день).
router.get('/by-task', async (req, res, next) => {
  const { from, to } = req.query;
  if (!isValidDateStr(from) || !isValidDateStr(to)) {
    return res.status(400).json({ error: 'Параметры from и to обязательны в формате YYYY-MM-DD' });
  }
  if (from > to) {
    return res.status(400).json({ error: 'Дата «с» не может быть позже даты «по»' });
  }

  const dates = dateRange(from, to);
  if (dates.length > MAX_RANGE_DAYS) {
    return res.status(400).json({ error: `Слишком большой период: максимум ${MAX_RANGE_DAYS} дней` });
  }

  try {
    // to_char, а не тип DATE: pg разбирает DATE в Date по локальному времени
    // процесса, и при поясе восточнее UTC день «съезжает» назад.
    const tasksInRange = await pool.query(
      `SELECT r.norm, r.title, r.status, r.slot, r.date, r.time_from,
              r.category_id, c.name AS category_name, c.color AS category_color
       FROM (
         SELECT ${NORM} AS norm, t.title, t.status, t.category_id,
                to_char(t.time_from, 'HH24:MI') AS time_from,
                to_char(d.date, 'YYYY-MM-DD') AS date,
                ${SLOT} AS slot
         FROM tasks t
         JOIN days d ON d.id = t.day_id
         WHERE t.user_id = $1 AND d.date BETWEEN $2 AND $3
       ) r
       LEFT JOIN categories c ON c.id = r.category_id
       ORDER BY r.date, r.slot`,
      [req.userId, from, to]
    );

    // Перенос «вычитается» из исходного дня: сама строка tasks уже уехала в новый день
    const movesInRange = await pool.query(
      `SELECT ${NORM} AS norm, t.title, t.category_id,
              to_char(t.time_from, 'HH24:MI') AS time_from,
              c.name AS category_name, c.color AS category_color,
              to_char(d1.date, 'YYYY-MM-DD') AS date
       FROM task_moves tm
       JOIN tasks t ON t.id = tm.task_id
       JOIN days d1 ON d1.id = tm.from_day_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE tm.user_id = $1 AND d1.date BETWEEN $2 AND $3
       ORDER BY d1.date, t.id`,
      [req.userId, from, to]
    );

    // Какие из названий сейчас есть в типовом расписании — такие показываем первыми
    const templateTitles = await pool.query(
      'SELECT DISTINCT lower(btrim(title)) AS norm FROM template_items WHERE user_id = $1',
      [req.userId]
    );
    const inTemplate = new Set(templateTitles.rows.map((r) => r.norm));

    const byKey = new Map();
    // Название и категорию берём из самой поздней задачи слота: если задачу
    // переименовали в пределах регистра или сменили категорию, показываем текущее.
    const ensure = (row, slot) => {
      const key = `${row.norm}#${slot}`;
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          key,
          norm: row.norm,
          slot,
          title: row.title,
          category_id: row.category_id,
          category_name: row.category_name || 'Без категории',
          category_color: row.category_color || '#94a3b8',
          in_template: inTemplate.has(row.norm),
          time_from: null,
          total: 0,
          done: 0,
          failed: 0,
          pending: 0,
          moved_away: 0,
          days: {},
          timeCounts: new Map(),
        };
        byKey.set(key, entry);
      }
      entry.title = row.title;
      entry.category_id = row.category_id;
      entry.category_name = row.category_name || 'Без категории';
      entry.category_color = row.category_color || '#94a3b8';
      return entry;
    };
    const ensureDay = (entry, date) => {
      if (!entry.days[date]) entry.days[date] = { done: 0, failed: 0, pending: 0, moved_away: 0 };
      return entry.days[date];
    };

    for (const row of tasksInRange.rows) {
      const entry = ensure(row, row.slot);
      entry.total += 1;
      entry[row.status] += 1;
      ensureDay(entry, row.date)[row.status] += 1;
      entry.timeCounts.set(row.time_from, (entry.timeCounts.get(row.time_from) || 0) + 1);
    }

    // Время слота — самое частое среди его задач, при равенстве более раннее
    const slotTimesByNorm = new Map();
    for (const entry of byKey.values()) {
      let best = null;
      let bestCount = -1;
      for (const [time, count] of entry.timeCounts) {
        if (count > bestCount || (count === bestCount && time !== null && (best === null || time < best))) {
          best = time;
          bestCount = count;
        }
      }
      entry.time_from = best;
      delete entry.timeCounts;
      if (!slotTimesByNorm.has(entry.norm)) slotTimesByNorm.set(entry.norm, new Map());
      slotTimesByNorm.get(entry.norm).set(entry.slot, best);
    }

    for (const row of movesInRange.rows) {
      const slot = nearestSlot(slotTimesByNorm.get(row.norm) || new Map(), row.time_from);
      const entry = ensure(row, slot);
      entry.moved_away += 1;
      ensureDay(entry, row.date).moved_away += 1;
    }

    // Сколько строк у названия — фронт по этому решает, показывать ли время
    const slotCount = new Map();
    // Слоты одного названия должны идти подряд, поэтому группу сортируем по
    // максимальному числу дней среди её слотов, а не по каждому слоту отдельно
    const groupDays = new Map();
    for (const entry of byKey.values()) {
      slotCount.set(entry.norm, (slotCount.get(entry.norm) || 0) + 1);
      const days = Object.keys(entry.days).length;
      groupDays.set(entry.norm, Math.max(groupDays.get(entry.norm) || 0, days));
    }

    const tasks = Array.from(byKey.values())
      .map((entry) => ({ ...entry, slot_count: slotCount.get(entry.norm) }))
      .sort((a, b) => {
        if (a.in_template !== b.in_template) return a.in_template ? -1 : 1;
        const byDays = groupDays.get(b.norm) - groupDays.get(a.norm);
        if (byDays !== 0) return byDays;
        const byTitle = a.title.localeCompare(b.title, 'ru');
        if (byTitle !== 0) return byTitle;
        return a.slot - b.slot;
      });

    res.json({ dates, tasks });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
