-- Напоминание у пункта шаблона (переносится в сгенерированные задачи)

ALTER TABLE template_items ADD COLUMN IF NOT EXISTS remind BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE template_items ADD COLUMN IF NOT EXISTS remind_minutes_before INTEGER NOT NULL DEFAULT 0;
