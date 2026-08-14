-- Планировщик задач: начальная схема БД

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name          TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT '#64748b',
    is_system  BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, name)
);

-- Шаблон = типовое расписание на будни ('weekday') или выходные ('weekend')
CREATE TABLE IF NOT EXISTS template_items (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template    TEXT NOT NULL CHECK (template IN ('weekday', 'weekend')),
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    title       TEXT NOT NULL,
    time_from   TIME NULL,
    time_to     TIME NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Один день конкретного пользователя
CREATE TABLE IF NOT EXISTS days (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date         DATE NOT NULL,
    is_generated BOOLEAN NOT NULL DEFAULT false,
    note         TEXT,
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS tasks (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_id      INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    title       TEXT NOT NULL,
    time_from   TIME NULL,
    time_to     TIME NULL,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
    source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('template', 'manual')),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- История переносов задач между днями
CREATE TABLE IF NOT EXISTS task_moves (
    id           SERIAL PRIMARY KEY,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_day_id  INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
    to_day_id    INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
    moved_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_day ON tasks(day_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_days_user_date ON days(user_id, date);
CREATE INDEX IF NOT EXISTS idx_template_items_user ON template_items(user_id, template);
CREATE INDEX IF NOT EXISTS idx_task_moves_from ON task_moves(from_day_id);
CREATE INDEX IF NOT EXISTS idx_task_moves_to ON task_moves(to_day_id);
