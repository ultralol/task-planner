-- Напоминания через Telegram-бота

-- Привязка Telegram к пользователю
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_link_code TEXT;

-- Напоминание у задачи
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS remind BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS remind_minutes_before INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;

-- Быстрый отбор задач, которым пора напомнить
CREATE INDEX IF NOT EXISTS idx_tasks_remind ON tasks(remind) WHERE remind = true AND reminded_at IS NULL;
