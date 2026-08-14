# CLAUDE.md

Контекст для AI-ассистента (Claude Code и т.п.), работающего с этим репозиторием.

## Что это за проект

Персональный планировщик задач на каждый день. Веб-приложение, разворачивается на своём VPS через Docker. Многопользовательское (JWT-авторизация), но по факту сейчас используется одним человеком.

Ключевая функциональность (см. README.md для деталей):
- типовое расписание на будни/выходные ("шаблоны"), из которого при первом открытии дня автоматически генерируются задачи;
- ручное редактирование задач и расписания любого конкретного дня;
- задачи с интервалом времени (от–до) и без времени;
- категории задач (сейчас: Работа, Личное, Привычки), расширяемо;
- статус задачи done/pending, чек-боксы;
- перенос задачи на другой день с сохранением истории переноса (таблица `task_moves`);
- страница аналитики (выполнено/невыполнено/перенесено, по дням и категориям).

## Стек

- **Backend**: Node.js + Express, без ORM — сырые SQL-запросы через `pg`. Аутентификация — JWT (`jsonwebtoken` + `bcryptjs`).
- **DB**: PostgreSQL. Миграции — простые `.sql`-файлы в `backend/src/migrations/`, применяются `backend/src/migrate.js` (идемпотентны, `CREATE TABLE IF NOT EXISTS`).
- **Frontend**: React (Vite) + Tailwind CSS + `react-router-dom` + `recharts` + `lucide-react` иконки + `axios`.
- **Деплой**: Docker Compose (`postgres` + `backend` + `frontend`-nginx). Nginx во frontend-контейнере проксирует `/api/*` на backend и отдаёт SPA.

## Структура

```
backend/src/
  index.js            # entrypoint Express
  db.js               # pg Pool
  migrate.js           # применение миграций при старте контейнера
  migrations/001_init.sql
  middleware/auth.js   # проверка JWT, кладёт req.userId
  middleware/errorHandler.js
  utils/date.js        # weekday/weekend по дате, валидация формата даты
  utils/days.js        # getOrCreate дня + генерация задач из шаблона
  routes/
    auth.js            # /api/auth/register, /login, /me
    categories.js       # /api/categories CRUD
    templates.js         # /api/templates/:type (weekday|weekend) + items CRUD
    days.js              # /api/days/:date — получить/создать день с задачами, note, sync-template
    tasks.js              # /api/tasks — CRUD, /status, /move
    analytics.js           # /api/analytics?from&to&category_id

frontend/src/
  api.js               # axios-инстанс с JWT-интерцептором
  context/AuthContext.jsx
  App.jsx               # роутинг, PrivateRoute
  components/           # Layout, DateNav, CategoryFilter, TaskItem, Modal, TaskFormModal, MoveTaskModal, TemplateItemFormModal
  pages/                # Login, Register, DayView, Templates, Analytics
```

## Модель данных (см. `backend/src/migrations/001_init.sql`)

`users` → `categories` (по user_id) → `template_items` (template: weekday/weekend, category_id) → `days` (user_id + date, unique) → `tasks` (day_id, category_id, status, source: template/manual) → `task_moves` (task_id, from_day_id, to_day_id — история переносов, никогда не удаляется).

Важный момент логики: при переносе задачи (`POST /api/tasks/:id/move`) сама строка `tasks` физически переезжает в новый `day_id`; старый день узнаёт о переносе через JOIN `task_moves`, а не через дублирование задачи.

## Как запускать локально

**Вариант А — быстрая итерация без Docker (рекомендуется при разработке через IDE):**

Нужен локальный/удалённый Postgres.

```bash
# backend
cd backend
cp .env.example .env        # прописать DATABASE_URL на свой Postgres
npm install
npm run migrate
npm run dev                  # http://localhost:4000, автоперезапуск при изменениях

# frontend (в другом терминале)
cd frontend
npm install
npm run dev                  # http://localhost:5173, /api проксируется на :4000 (см. vite.config.js)
```

**Вариант Б — через Docker Compose (ближе к продакшену, но пересборка дольше):**
```bash
cp .env.example .env
docker compose up -d --build
```

## Конвенции

- **Весь пользовательский текст, комментарии в коде и сообщения об ошибках — на русском.** Это сознательный выбор, сохраняй его в новых частях кода.
- Backend отвечает JSON вида `{ error: "текст" }` при ошибках (см. `middleware/errorHandler.js`) и `{ <entity>: {...} }` / `{ <entities>: [...] }` при успехе — придерживайся этой формы в новых роутах.
- Даты передаются и хранятся как строки `YYYY-MM-DD` (валидация — `utils/date.js: isValidDateStr`). Время — `HH:MM` на фронте, Postgres `TIME` в БД.
- SQL — сырые запросы с параметрами (`$1, $2...`), без ORM. Транзакции — через `pool.connect()` + `BEGIN/COMMIT/ROLLBACK` там, где несколько связанных запросов (см. `routes/tasks.js: move`).
- Frontend: Tailwind-утилиты прямо в JSX, без CSS-модулей. Цветовая палитра и шрифты заданы в `frontend/tailwind.config.js` (цвета: `paper`, `ink`, `accent`, `clay`, `done`, `pending`; шрифты: `font-display` — Source Serif 4 для заголовков, `font-mono` — IBM Plex Mono для времени). Придерживайся этой палитры вместо изобретения новых цветов.
- Все защищённые роуты фронтенда рендерятся через `PrivateRoute` в `App.jsx`, все защищённые роуты бэкенда — через `middleware/auth.js` (`router.use(auth)` в начале файла роута).

## Известные пробелы / то, что вероятно попросят доделать

- Нет UI для управления категориями (добавление/удаление/смена цвета) — API (`routes/categories.js`) уже полностью готово, не хватает только страницы/модалки на фронте.
- Нет повторяющихся задач с произвольным интервалом (сейчас только жёсткое деление будни/выходные через `template_items.template`).
- Нет напоминаний/уведомлений о задачах с привязкой ко времени.
- `frontend/src/pages/Templates.jsx` и `DayView.jsx` дублируют логику формы задачи (`TaskFormModal` и `TemplateItemFormModal` почти идентичны) — при рефакторинге можно объединить в один параметризуемый компонент.
- Тесты отсутствуют.

## Чего не делать

- Не переводи интерфейс на английский.
- Не добавляй ORM (Prisma/Sequelize) без явного запроса — текущий подход на сырых SQL-запросах осознанный, для маленького личного проекта этого достаточно.
- Не меняй cхему `task_moves` так, чтобы терялась история переносов — это explicit-требование из ТЗ.
