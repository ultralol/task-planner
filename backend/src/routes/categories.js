const express = require('express');
const { pool } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, color, is_system, sort_order FROM categories WHERE user_id = $1 ORDER BY sort_order, id',
      [req.userId]
    );
    res.json({ categories: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Название категории обязательно' });
  }
  try {
    const countResult = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories WHERE user_id = $1',
      [req.userId]
    );
    const result = await pool.query(
      'INSERT INTO categories (user_id, name, color, sort_order) VALUES ($1, $2, $3, $4) RETURNING id, name, color, is_system, sort_order',
      [req.userId, name.trim(), color || '#64748b', countResult.rows[0].next]
    );
    res.status(201).json({ category: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Категория с таким названием уже существует' });
    }
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  const { name, color } = req.body;
  try {
    const result = await pool.query(
      `UPDATE categories SET name = COALESCE($1, name), color = COALESCE($2, color)
       WHERE id = $3 AND user_id = $4
       RETURNING id, name, color, is_system, sort_order`,
      [name, color, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }
    res.json({ category: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
