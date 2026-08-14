-- Кнопка «Обновить из шаблона»:
-- отслеживаем, когда день сгенерирован/синхронизирован и когда менялся шаблон.

ALTER TABLE days ADD COLUMN IF NOT EXISTS template_synced_at TIMESTAMPTZ;

-- Время последнего изменения шаблона пользователя (по типу weekday/weekend)
CREATE TABLE IF NOT EXISTS template_state (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template   TEXT NOT NULL CHECK (template IN ('weekday', 'weekend')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, template)
);
