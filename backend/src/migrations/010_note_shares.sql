-- Доступ к заметкам для других пользователей: явные права на чтение/редактирование/удаление.
-- Наличие строки без единого разрешённого права смысла не имеет — такую строку приложение удаляет,
-- а не хранит с одними false, поэтому отдельного столбца-переключателя «доступ вкл/выкл» не требуется.
CREATE TABLE IF NOT EXISTS note_shares (
    id         SERIAL PRIMARY KEY,
    note_id    INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_read   BOOLEAN NOT NULL DEFAULT true,
    can_edit   BOOLEAN NOT NULL DEFAULT false,
    can_delete BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(note_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_note_shares_note ON note_shares(note_id);
CREATE INDEX IF NOT EXISTS idx_note_shares_user ON note_shares(user_id);
