const express = require('express');
const { pool } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// $1 везде — id текущего пользователя (для вычисления is_owner/can_edit/can_delete)
const NOTE_FIELDS = `n.id, n.title, n.body, n.created_at, n.updated_at,
                      n.user_id AS owner_id, u.name AS owner_name,
                      (n.user_id = $1) AS is_owner,
                      CASE WHEN n.user_id = $1 THEN true ELSE COALESCE(ns.can_edit, false) END AS can_edit,
                      CASE WHEN n.user_id = $1 THEN true ELSE COALESCE(ns.can_delete, false) END AS can_delete`;

async function loadNote(userId, noteId) {
  const result = await pool.query(
    `SELECT ${NOTE_FIELDS}
     FROM notes n
     JOIN users u ON u.id = n.user_id
     LEFT JOIN note_shares ns ON ns.note_id = n.id AND ns.user_id = $1
     WHERE n.id = $2 AND (n.user_id = $1 OR (ns.user_id = $1 AND ns.can_read = true))`,
    [userId, noteId]
  );
  return result.rows[0];
}

// Список заметок: свои + те, к которым другой пользователь открыл доступ на чтение
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ${NOTE_FIELDS}
       FROM notes n
       JOIN users u ON u.id = n.user_id
       LEFT JOIN note_shares ns ON ns.note_id = n.id AND ns.user_id = $1
       WHERE n.user_id = $1 OR (ns.user_id = $1 AND ns.can_read = true)
       ORDER BY n.updated_at DESC, n.id DESC`,
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
    const inserted = await pool.query(
      `INSERT INTO notes (user_id, title, body) VALUES ($1, $2, $3) RETURNING id`,
      [req.userId, (title || '').trim(), body || '']
    );
    const note = await loadNote(req.userId, inserted.rows[0].id);
    res.status(201).json({ note });
  } catch (err) {
    next(err);
  }
});

// Изменить заметку — владелец или пользователь с правом редактирования
router.put('/:id', async (req, res, next) => {
  const { title, body } = req.body;
  try {
    const result = await pool.query(
      `UPDATE notes SET title = $1, body = $2, updated_at = now()
       WHERE id = $3 AND (
         user_id = $4
         OR id IN (SELECT note_id FROM note_shares WHERE user_id = $4 AND can_edit = true)
       )
       RETURNING id`,
      [(title || '').trim(), body || '', req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заметка не найдена или недоступна для редактирования' });
    }
    const note = await loadNote(req.userId, result.rows[0].id);
    res.json({ note });
  } catch (err) {
    next(err);
  }
});

// Удалить заметку — владелец или пользователь с правом удаления
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM notes
       WHERE id = $1 AND (
         user_id = $2
         OR id IN (SELECT note_id FROM note_shares WHERE user_id = $2 AND can_delete = true)
       )
       RETURNING id`,
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заметка не найдена или недоступна для удаления' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Список пользователей, которым открыт доступ к заметке (только владелец)
router.get('/:id/shares', async (req, res, next) => {
  try {
    const noteCheck = await pool.query('SELECT id FROM notes WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.userId,
    ]);
    if (noteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Заметка не найдена' });
    }
    const result = await pool.query(
      `SELECT ns.user_id, u.name, u.email, ns.can_read, ns.can_edit, ns.can_delete
       FROM note_shares ns
       JOIN users u ON u.id = ns.user_id
       WHERE ns.note_id = $1
       ORDER BY u.name`,
      [req.params.id]
    );
    res.json({ shares: result.rows });
  } catch (err) {
    next(err);
  }
});

// Выдать/изменить права пользователю на заметку (только владелец).
// Если все три права снимаются — запись удаляется, а не хранится с одними false.
router.put('/:id/shares/:userId', async (req, res, next) => {
  const targetUserId = Number(req.params.userId);
  const canRead = Boolean(req.body.can_read);
  const canEdit = Boolean(req.body.can_edit);
  const canDelete = Boolean(req.body.can_delete);

  if (targetUserId === req.userId) {
    return res.status(400).json({ error: 'Нельзя открыть доступ к заметке самому себе' });
  }

  try {
    const noteCheck = await pool.query('SELECT id FROM notes WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.userId,
    ]);
    if (noteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Заметка не найдена' });
    }

    if (!canRead && !canEdit && !canDelete) {
      await pool.query('DELETE FROM note_shares WHERE note_id = $1 AND user_id = $2', [
        req.params.id,
        targetUserId,
      ]);
      return res.json({ share: null });
    }

    const userCheck = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [targetUserId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const result = await pool.query(
      `INSERT INTO note_shares (note_id, user_id, can_read, can_edit, can_delete)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (note_id, user_id) DO UPDATE SET can_read = $3, can_edit = $4, can_delete = $5
       RETURNING user_id, can_read, can_edit, can_delete`,
      [req.params.id, targetUserId, canRead, canEdit, canDelete]
    );
    res.json({ share: { ...result.rows[0], name: userCheck.rows[0].name, email: userCheck.rows[0].email } });
  } catch (err) {
    next(err);
  }
});

// Полностью убрать доступ пользователя к заметке (только владелец)
router.delete('/:id/shares/:userId', async (req, res, next) => {
  try {
    const noteCheck = await pool.query('SELECT id FROM notes WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.userId,
    ]);
    if (noteCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Заметка не найдена' });
    }
    await pool.query('DELETE FROM note_shares WHERE note_id = $1 AND user_id = $2', [
      req.params.id,
      req.params.userId,
    ]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
