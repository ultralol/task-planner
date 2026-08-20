const express = require('express');
const { pool } = require('../db');
const { auth } = require('../middleware/auth');
const { isValidDateStr, dateRange } = require('../utils/date');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res, next) => {
  const { from, to, category_id } = req.query;
  if (!isValidDateStr(from) || !isValidDateStr(to)) {
    return res.status(400).json({ error: 'Параметры from и to обязательны в формате YYYY-MM-DD' });
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
      pending: tasks.filter((t) => t.status === 'pending').length,
      moved_away: moves.length,
    };
    summary.completion_rate = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;

    const byDayMap = new Map();
    const ensureDay = (date) => {
      if (!byDayMap.has(date)) {
        byDayMap.set(date, { date, total: 0, done: 0, pending: 0, moved_away: 0 });
      }
      return byDayMap.get(date);
    };
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

// Максимальная длина диапазона для матрицы «задача × день» — иначе ответ
// разрастается до тысяч ячеек, а таблицу всё равно невозможно смотреть.
const MAX_MATRIX_DAYS = 366;

// Нормализация названия: одинаковыми считаются задачи с совпадающим названием
// без учёта регистра и пробелов по краям. Ровно так же шаблон узнаёт «свои»
// задачи в дне (см. utils/days.js: generateFromTemplate, skipExistingTitles) —
// прямой ссылки tasks -> template_items в схеме нет.
const NORM = `lower(btrim(t.title))`;

// Выполнение конкретных задач по дням: для каждого названия — что было в каждый
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
  if (dates.length > MAX_MATRIX_DAYS) {
    return res.status(400).json({ error: `Слишком большой период: максимум ${MAX_MATRIX_DAYS} дней` });
  }

  try {
    // to_char, а не тип DATE: pg разбирает DATE в Date по локальному времени
    // процесса, и при поясе восточнее UTC день «съезжает» назад.
    const tasksInRange = await pool.query(
      `SELECT ${NORM} AS norm, t.title, t.status, t.id,
              t.category_id, c.name AS category_name, c.color AS category_color,
              to_char(d.date, 'YYYY-MM-DD') AS date
       FROM tasks t
       JOIN days d ON d.id = t.day_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1 AND d.date BETWEEN $2 AND $3
       ORDER BY d.date, t.id`,
      [req.userId, from, to]
    );

    // Перенос «вычитается» из исходного дня: сама строка tasks уже уехала в новый день
    const movesInRange = await pool.query(
      `SELECT ${NORM} AS norm, t.title, t.id,
              t.category_id, c.name AS category_name, c.color AS category_color,
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

    const byNorm = new Map();
    // Название и категорию берём из самой поздней задачи с этим norm: если задачу
    // переименовали в пределах регистра или сменили категорию, показываем текущее.
    const ensure = (row) => {
      let entry = byNorm.get(row.norm);
      if (!entry) {
        entry = {
          norm: row.norm,
          title: row.title,
          category_id: row.category_id,
          category_name: row.category_name || 'Без категории',
          category_color: row.category_color || '#94a3b8',
          in_template: inTemplate.has(row.norm),
          total: 0,
          done: 0,
          pending: 0,
          moved_away: 0,
          days: {},
        };
        byNorm.set(row.norm, entry);
      }
      entry.title = row.title;
      entry.category_id = row.category_id;
      entry.category_name = row.category_name || 'Без категории';
      entry.category_color = row.category_color || '#94a3b8';
      return entry;
    };
    const ensureDay = (entry, date) => {
      if (!entry.days[date]) entry.days[date] = { done: 0, pending: 0, moved_away: 0 };
      return entry.days[date];
    };

    for (const row of tasksInRange.rows) {
      const entry = ensure(row);
      entry.total += 1;
      entry[row.status] += 1;
      ensureDay(entry, row.date)[row.status] += 1;
    }
    for (const row of movesInRange.rows) {
      const entry = ensure(row);
      entry.moved_away += 1;
      ensureDay(entry, row.date).moved_away += 1;
    }

    // Сначала пункты типового расписания, дальше — по числу дней, где задача встречалась
    const tasks = Array.from(byNorm.values()).sort((a, b) => {
      if (a.in_template !== b.in_template) return a.in_template ? -1 : 1;
      const byDays = Object.keys(b.days).length - Object.keys(a.days).length;
      if (byDays !== 0) return byDays;
      return a.title.localeCompare(b.title, 'ru');
    });

    res.json({ dates, tasks });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
