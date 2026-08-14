const express = require('express');
const { pool } = require('../db');
const { auth } = require('../middleware/auth');
const { isValidDateStr } = require('../utils/date');
const { getOrCreateDayWithGeneration } = require('../utils/days');

const router = express.Router();
router.use(auth);

const TASK_FIELDS = `t.id, t.title, t.note, t.time_from, t.time_to, t.status, t.source, t.sort_order,
                     t.remind, t.remind_minutes_before,
                     t.category_id, c.name AS category_name, c.color AS category_color, d.date`;

async function loadTask(client, userId, taskId) {
  const result = await client.query(
    `SELECT ${TASK_FIELDS} FROM tasks t
     JOIN days d ON d.id = t.day_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.id = $1 AND t.user_id = $2`,
    [taskId, userId]
  );
  return result.rows[0];
}

router.post('/', async (req, res, next) => {
  const { date, title, category_id, time_from, time_to, note, remind, remind_minutes_before } = req.body;
  if (!isValidDateStr(date)) {
    return res.status(400).json({ error: 'Некорректная дата' });
  }
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Название задачи обязательно' });
  }
  // Напоминание имеет смысл только для задач со временем начала
  const willRemind = Boolean(remind) && Boolean(time_from);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const day = await getOrCreateDayWithGeneration(client, req.userId, date);

    const countResult = await client.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM tasks WHERE day_id = $1',
      [day.id]
    );

    const inserted = await client.query(
      `INSERT INTO tasks (user_id, day_id, category_id, title, time_from, time_to, note, remind, remind_minutes_before, source, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'manual', $10) RETURNING id`,
      [
        req.userId,
        day.id,
        category_id || null,
        title.trim(),
        time_from || null,
        time_to || null,
        note?.trim() || null,
        willRemind,
        Number(remind_minutes_before) || 0,
        countResult.rows[0].next,
      ]
    );

    const task = await loadTask(client, req.userId, inserted.rows[0].id);
    await client.query('COMMIT');
    res.status(201).json({ task });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.put('/:id', async (req, res, next) => {
  const { title, category_id, time_from, time_to, note, remind, remind_minutes_before } = req.body;
  const willRemind = Boolean(remind) && Boolean(time_from);
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.userId,
    ]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    // При редактировании перевзводим напоминание (reminded_at = NULL)
    await client.query(
      `UPDATE tasks SET
         title = COALESCE($1, title),
         category_id = $2,
         time_from = $3,
         time_to = $4,
         note = $5,
         remind = $6,
         remind_minutes_before = $7,
         reminded_at = NULL,
         updated_at = now()
       WHERE id = $8 AND user_id = $9`,
      [
        title,
        category_id ?? null,
        time_from ?? null,
        time_to ?? null,
        note?.trim() || null,
        willRemind,
        Number(remind_minutes_before) || 0,
        req.params.id,
        req.userId,
      ]
    );

    const task = await loadTask(client, req.userId, req.params.id);
    res.json({ task });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

router.patch('/:id/status', async (req, res, next) => {
  const { status } = req.body;
  if (status !== 'done' && status !== 'pending') {
    return res.status(400).json({ error: "status должен быть 'done' или 'pending'" });
  }
  try {
    const result = await pool.query(
      'UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2 AND user_id = $3 RETURNING id',
      [status, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    const client = await pool.connect();
    const task = await loadTask(client, req.userId, req.params.id);
    client.release();
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

// Перенос задачи на другой день (с сохранением истории переноса)
router.post('/:id/move', async (req, res, next) => {
  const { to_date, time_from, time_to } = req.body;
  if (!isValidDateStr(to_date)) {
    return res.status(400).json({ error: 'Некорректная целевая дата' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const taskResult = await client.query(
      'SELECT id, day_id FROM tasks WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [req.params.id, req.userId]
    );
    if (taskResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    const fromDayId = taskResult.rows[0].day_id;

    const toDay = await getOrCreateDayWithGeneration(client, req.userId, to_date);

    if (toDay.id === fromDayId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Задача уже находится в этот день' });
    }

    // Перенос может менять и дату, и время. Если время передано — обновляем его,
    // иначе оставляем прежнее (только смена дня).
    // Перенос перевзводит напоминание (reminded_at = NULL) — новый день/время
    if (time_from !== undefined || time_to !== undefined) {
      await client.query(
        'UPDATE tasks SET day_id = $1, time_from = $2, time_to = $3, reminded_at = NULL, updated_at = now() WHERE id = $4',
        [toDay.id, time_from || null, time_from && time_to ? time_to : null, req.params.id]
      );
    } else {
      await client.query('UPDATE tasks SET day_id = $1, reminded_at = NULL, updated_at = now() WHERE id = $2', [
        toDay.id,
        req.params.id,
      ]);
    }

    await client.query(
      'INSERT INTO task_moves (task_id, user_id, from_day_id, to_day_id) VALUES ($1, $2, $3, $4)',
      [req.params.id, req.userId, fromDayId, toDay.id]
    );

    const task = await loadTask(client, req.userId, req.params.id);
    await client.query('COMMIT');
    res.json({ task });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.params.id,
      req.userId,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
