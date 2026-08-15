const { pool } = require('../db');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TZ = process.env.APP_TIMEZONE || 'Europe/Moscow';
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;

let botUsername = null;
let pollOffset = 0;

function isEnabled() {
  return Boolean(TOKEN);
}

function getBotUsername() {
  return botUsername;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tg(method, params) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || res.status}`);
  return data.result;
}

async function sendMessage(chatId, text) {
  if (!isEnabled()) throw new Error('Telegram-бот не настроен');
  return tg('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });
}

// Привязка чата к пользователю по одноразовому коду (из /start <code>)
async function linkChat(code, chatId) {
  const res = await pool.query(
    `UPDATE users SET telegram_chat_id = $1, telegram_link_code = NULL
     WHERE telegram_link_code = $2 RETURNING id, name`,
    [String(chatId), code]
  );
  return res.rows[0] || null;
}

async function handleUpdate(update) {
  const msg = update.message;
  if (!msg || !msg.text) return;
  const text = msg.text.trim();
  const chatId = msg.chat.id;
  if (text.startsWith('/start')) {
    const code = text.split(/\s+/)[1];
    if (code) {
      const user = await linkChat(code, chatId);
      if (user) {
        await sendMessage(chatId, `✅ Telegram подключён к «${user.name}». Буду присылать напоминания о задачах.`);
      } else {
        await sendMessage(chatId, 'Код не найден или устарел. Откройте раздел «Уведомления» в приложении и нажмите «Подключить Telegram» ещё раз.');
      }
    } else {
      await sendMessage(chatId, 'Чтобы подключить напоминания, откройте раздел «Уведомления» в приложении и нажмите «Подключить Telegram».');
    }
  }
}

// Long-polling обновлений (для привязки чатов)
async function pollLoop() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const updates = await tg('getUpdates', { offset: pollOffset, timeout: 30 });
      for (const u of updates) {
        pollOffset = u.update_id + 1;
        try {
          await handleUpdate(u);
        } catch (e) {
          console.error('Telegram handleUpdate error:', e.message);
        }
      }
    } catch (e) {
      console.error('Telegram poll error:', e.message);
      await sleep(3000);
    }
  }
}

// Отбор задач, которым пора напомнить, и отправка
async function runReminders() {
  if (!isEnabled()) return;
  let rows;
  try {
    const remindAt = `(((d.date + t.time_from) AT TIME ZONE $1) - make_interval(mins => t.remind_minutes_before))`;
    const result = await pool.query(
      `SELECT t.id, t.title, t.time_from, u.telegram_chat_id
       FROM tasks t
       JOIN days d ON d.id = t.day_id
       JOIN users u ON u.id = t.user_id
       WHERE t.remind = true
         AND t.reminded_at IS NULL
         AND t.status = 'pending'
         AND t.time_from IS NOT NULL
         AND u.telegram_chat_id IS NOT NULL
         AND ${remindAt} <= now()
         AND ${remindAt} > now() - interval '2 hours'`,
      [TZ]
    );
    rows = result.rows;
  } catch (e) {
    console.error('Reminder query error:', e.message);
    return;
  }

  for (const r of rows) {
    const text = `⏰ Напоминание: «${r.title}»${r.time_from ? ` в ${r.time_from.slice(0, 5)}` : ''}`;
    try {
      await sendMessage(r.telegram_chat_id, text);
      await pool.query('UPDATE tasks SET reminded_at = now() WHERE id = $1', [r.id]);
    } catch (e) {
      console.error('Reminder send failed for task', r.id, e.message);
    }
  }
}

function startScheduler() {
  setInterval(runReminders, 60 * 1000);
}

async function init() {
  if (!isEnabled()) {
    console.log('Telegram-бот не настроен (TELEGRAM_BOT_TOKEN не задан) — напоминания отключены.');
    return;
  }
  try {
    const me = await tg('getMe');
    botUsername = me.username;
    console.log(`Telegram-бот @${botUsername} подключён, напоминания включены.`);
    pollLoop();
    startScheduler();
  } catch (e) {
    console.error('Не удалось инициализировать Telegram-бота:', e.message);
  }
}

module.exports = { init, isEnabled, getBotUsername, sendMessage, runReminders };
