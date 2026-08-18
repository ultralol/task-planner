const express = require('express');
const { pool } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// Список всех остальных пользователей — для выбора, кому открыть доступ к заметке
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name, email FROM users WHERE id != $1 ORDER BY name', [
      req.userId,
    ]);
    res.json({ users: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
