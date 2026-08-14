const express = require('express');
const { pool } = require('../db');
const { auth } = require('../middleware/auth');
const { markTemplateChanged } = require('../utils/days');

const router = express.Router();
router.use(auth);

function assertValidTemplate(type, res) {
  if (type !== 'weekday' && type !== 'weekend') {
    res.status(400).json({ error: "Тип шаблона должен быть 'weekday' или 'weekend'" });
    return false;
  }
  return true;
}

// Список пунктов шаблона
router.get('/:type', async (req, res, next) => {
  const { type } = req.params;
  if (!assertValidTemplate(type, res)) return;
  try {
    const result = await pool.query(
      `SELECT id, category_id, title, time_from, time_to, note, remind, remind_minutes_before, sort_order
       FROM template_items WHERE user_id = $1 AND template = $2
       ORDER BY time_from NULLS LAST, time_to NULLS LAST, sort_order, id`,
      [req.userId, type]
    );
    res.json({ items: result.rows });
  } catch (err) {
    next(err);
  }
});

// Добавить пункт в шаблон
router.post('/:type/items', async (req, res, next) => {
  const { type } = req.params;
  if (!assertValidTemplate(type, res)) return;
  const { title, category_id, time_from, time_to, note, remind, remind_minutes_before } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Название задачи обязательно' });
  }
  const willRemind = Boolean(remind) && Boolean(time_from);
  try {
    const countResult = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM template_items WHERE user_id = $1 AND template = $2',
      [req.userId, type]
    );
    const result = await pool.query(
      `INSERT INTO template_items (user_id, template, category_id, title, time_from, time_to, note, remind, remind_minutes_before, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, category_id, title, time_from, time_to, note, remind, remind_minutes_before, sort_order`,
      [
        req.userId,
        type,
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
    await markTemplateChanged(pool, req.userId, type);
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Изменить пункт шаблона
router.put('/items/:id', async (req, res, next) => {
  const { title, category_id, time_from, time_to, note, remind, remind_minutes_before, sort_order } = req.body;
  const willRemind = Boolean(remind) && Boolean(time_from);
  try {
    const result = await pool.query(
      `UPDATE template_items SET
         title = COALESCE($1, title),
         category_id = $2,
         time_from = $3,
         time_to = $4,
         note = $5,
         remind = $6,
         remind_minutes_before = $7,
         sort_order = COALESCE($8, sort_order)
       WHERE id = $9 AND user_id = $10
       RETURNING id, category_id, title, time_from, time_to, note, remind, remind_minutes_before, sort_order, template`,
      [
        title,
        category_id ?? null,
        time_from ?? null,
        time_to ?? null,
        note?.trim() || null,
        willRemind,
        Number(remind_minutes_before) || 0,
        sort_order,
        req.params.id,
        req.userId,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пункт шаблона не найден' });
    }
    const { template, ...item } = result.rows[0];
    await markTemplateChanged(pool, req.userId, template);
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

// Удалить пункт шаблона
router.delete('/items/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM template_items WHERE id = $1 AND user_id = $2 RETURNING template',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пункт шаблона не найден' });
    }
    await markTemplateChanged(pool, req.userId, result.rows[0].template);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
