const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { auth } = require('../middleware/auth');
const telegram = require('../services/telegram');

const router = express.Router();
router.use(auth);

// Статус подключения Telegram
router.get('/status', async (req, res, next) => {
  try {
    const r = await pool.query('SELECT telegram_chat_id FROM users WHERE id = $1', [req.userId]);
    res.json({
      enabled: telegram.isEnabled(),
      connected: Boolean(r.rows[0]?.telegram_chat_id),
      bot_username: telegram.getBotUsername(),
    });
  } catch (err) {
    next(err);
  }
});

// Сгенерировать одноразовый код и ссылку для привязки
router.post('/link', async (req, res, next) => {
  if (!telegram.isEnabled()) {
    return res.status(503).json({ error: 'Telegram-бот не настроен на сервере' });
  }
  const bot = telegram.getBotUsername();
  if (!bot) {
    return res.status(503).json({ error: 'Бот ещё не готов, попробуйте позже' });
  }
  try {
    const code = crypto.randomBytes(8).toString('hex');
    await pool.query('UPDATE users SET telegram_link_code = $1 WHERE id = $2', [code, req.userId]);
    res.json({ url: `https://t.me/${bot}?start=${code}` });
  } catch (err) {
    next(err);
  }
});

// Отвязать Telegram
router.post('/unlink', async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE users SET telegram_chat_id = NULL, telegram_link_code = NULL WHERE id = $1',
      [req.userId]
    );
    res.json({ connected: false });
  } catch (err) {
    next(err);
  }
});

// Прислать тестовое сообщение
router.post('/test', async (req, res, next) => {
  try {
    const r = await pool.query('SELECT telegram_chat_id FROM users WHERE id = $1', [req.userId]);
    const chatId = r.rows[0]?.telegram_chat_id;
    if (!chatId) return res.status(400).json({ error: 'Telegram не подключён' });
    await telegram.sendMessage(chatId, '🔔 Проверка: уведомления работают.');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
