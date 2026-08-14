const express = require('express');
const { pool } = require('../db');
const { auth } = require('../middleware/auth');
const { isValidDateStr, templateTypeForDate } = require('../utils/date');
const { getOrCreateDayWithGeneration, generateFromTemplate } = require('../utils/days');

const router = express.Router();
router.use(auth);

const TASK_FIELDS = `t.id, t.title, t.note, t.time_from, t.time_to, t.status, t.source, t.sort_order,
                     t.remind, t.remind_minutes_before,
                     t.category_id, c.name AS category_name, c.color AS category_color`;

router.get('/:date', async (req, res, next) => {
  const { date } = req.params;
  if (!isValidDateStr(date)) {
    return res.status(400).json({ error: 'Некорректная дата, ожидается YYYY-MM-DD' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const day = await getOrCreateDayWithGeneration(client, req.userId, date);

    const tasks = (
      await client.query(
        `SELECT ${TASK_FIELDS} FROM tasks t LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.day_id = $1 ORDER BY t.time_from NULLS LAST, t.time_to NULLS LAST, t.sort_order, t.id`,
        [day.id]
      )
    ).rows;

    // Задачи, которые изначально стояли в этот день, но были перенесены на другой день
    const movedAway = (
      await client.query(
        `SELECT tm.moved_at, t.id AS task_id, t.title, t.category_id, c.name AS category_name,
                c.color AS category_color, d2.date AS moved_to_date
         FROM task_moves tm
         JOIN tasks t ON t.id = tm.task_id
         JOIN days d2 ON d2.id = tm.to_day_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE tm.from_day_id = $1
         ORDER BY tm.moved_at DESC`,
        [day.id]
      )
    ).rows;

    // Менялся ли шаблон после последней генерации/синхронизации этого дня —
    // сигнал для кнопки «Обновить из шаблона» на фронте.
    const type = templateTypeForDate(day.date);
    const stateRes = await client.query(
      'SELECT updated_at FROM template_state WHERE user_id = $1 AND template = $2',
      [req.userId, type]
    );
    const stateAt = stateRes.rows[0]?.updated_at || null;
    const templateChanged =
      stateAt != null &&
      (day.template_synced_at == null || new Date(stateAt) > new Date(day.template_synced_at));

    await client.query('COMMIT');
    res.json({ day, tasks, moved_away: movedAway, template_changed: templateChanged });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.put('/:date/note', async (req, res, next) => {
  const { date } = req.params;
  const { note } = req.body;
  if (!isValidDateStr(date)) {
    return res.status(400).json({ error: 'Некорректная дата' });
  }
  const client = await pool.connect();
  try {
    const day = await getOrCreateDayWithGeneration(client, req.userId, date);
    const result = await client.query(
      'UPDATE days SET note = $1 WHERE id = $2 RETURNING id, date, is_generated, note',
      [note || null, day.id]
    );
    res.json({ day: result.rows[0] });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

// Подтянуть в день пункты шаблона, которых там ещё нет по названию (не трогая уже добавленные/изменённые задачи)
router.post('/:date/sync-template', async (req, res, next) => {
  const { date } = req.params;
  if (!isValidDateStr(date)) {
    return res.status(400).json({ error: 'Некорректная дата' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const day = await getOrCreateDayWithGeneration(client, req.userId, date);
    const existing = await client.query('SELECT title FROM tasks WHERE day_id = $1', [day.id]);
    const existingTitles = new Set(existing.rows.map((r) => r.title.trim().toLowerCase()));
    const added = await generateFromTemplate(client, req.userId, day, { skipExistingTitles: existingTitles });
    await client.query('UPDATE days SET template_synced_at = now() WHERE id = $1', [day.id]);
    await client.query('COMMIT');
    res.json({ added });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
