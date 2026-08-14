const express = require('express');
const { pool } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

const FIELDS = 'id, title, body, created_at, updated_at';

// Список заметок пользователя — сначала недавно обновлённые
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ${FIELDS} FROM notes WHERE user_id = $1 ORDER BY updated_at DESC, id DESC`,
      [req.userId]
    );
    res.json({ notes: result.rows });
  } catch (err) {
    next(err);
  }
});

// Создать заметку (заголовок необязателен)
router.post('/', async (req, res, next) => {
  const { title, body } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO notes (user_id, title, body) VALUES ($1, $2, $3) RETURNING ${FIELDS}`,
      [req.userId, (title || '').trim(), body || '']
    );
    res.status(201).json({ note: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Изменить заметку (заголовок необязателен)
router.put('/:id', async (req, res, next) => {
  const { title, body } = req.body;
  try {
    const result = await pool.query(
      `UPDATE notes SET title = $1, body = $2, updated_at = now()
       WHERE id = $3 AND user_id = $4 RETURNING ${FIELDS}`,
      [(title || '').trim(), body || '', req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заметка не найдена' });
    }
    res.json({ note: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Удалить заметку
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.params.id,
      req.userId,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заметка не найдена' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
