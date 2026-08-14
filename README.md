# Планировщик задач

Веб-приложение для планирования дня: типовое расписание на будни/выходные, задачи с интервалами времени, категории, чек-боксы выполнения, перенос задач между днями с сохранением истории, аналитика.

Стек: **React (Vite + Tailwind)** — фронтенд, **Node.js/Express** — backend API, **PostgreSQL** — база данных. Всё упаковано в Docker.

## Структура проекта

```
task-planner/
├── backend/          # Express API
│   └── src/
│       ├── migrations/   # SQL-миграции
│       ├── routes/       # auth, categories, templates, days, tasks, analytics
│       └── ...
├── frontend/         # React SPA
│   └── src/
│       ├── pages/        # DayView, Templates, Analytics, Login, Register
│       └── components/
├── docker-compose.yml
└── .env.example
```

## Запуск на VPS (production, через Docker)

Понадобится: VPS с Linux и **Docker** + **Docker Compose**. Проще всего взять у провайдера образ с уже предустановленным Docker (обычно «Docker» в маркетплейсе / one-click) — тогда ставить ничего не нужно.

1. Скопируйте проект на сервер (например, через `git clone` вашего репозитория или `scp`):
   ```bash
   scp -r task-planner user@your-server:/opt/task-planner
   ssh user@your-server
   cd /opt/task-planner
   ```

2. Создайте `.env` из шаблона и заполните переменные:
   ```bash
   cp .env.example .env
   nano .env
   ```
   - `JWT_SECRET` — длинная случайная строка (`openssl rand -hex 32`).
   - `POSTGRES_PASSWORD` — надёжный пароль БД.
   - `TELEGRAM_BOT_TOKEN` — токен бота от `@BotFather` (напоминания; можно оставить пустым).
   - `APP_DOMAIN` — домен для HTTPS (см. ниже). По умолчанию `:80` — только HTTP.

3. Соберите и запустите:
   ```bash
   docker compose up -d --build
   ```
   Поднимутся контейнеры: `postgres`, `backend` и `frontend` (внутри сети) и `caddy` (порты 80/443 — точка входа, при наличии домена сам получает HTTPS).

4. Откройте `http://ваш-сервер-или-домен` — увидите страницу входа. Зарегистрируйте аккаунт — готово.

5. Проверить логи, если что-то не работает:
   ```bash
   docker compose logs -f backend
   docker compose logs -f frontend
   ```

### Домен и HTTPS

HTTPS встроен через **Caddy** — задаётся хостнейм в `APP_DOMAIN` (файл `.env`):

- **Свой домен:** направьте A-запись домена на IP сервера, задайте `APP_DOMAIN=planner.вашдомен.ру`. Caddy сам получит и продлит сертификат Let's Encrypt.
- **Без домена:** используйте бесплатный `nip.io` — `APP_DOMAIN=<IP-через-дефисы>.nip.io` (например `203-0-113-5.nip.io`). Тоже даёт настоящий HTTPS.
- **Только HTTP:** оставьте `APP_DOMAIN=:80` (без сертификата; PWA не установится).

Порты 80 и 443 должны быть открыты в firewall/security group. После смены `APP_DOMAIN` — `docker compose up -d`.

HTTPS обязателен, чтобы установить приложение как **PWA** на телефон (Chrome → «Установить приложение»).

### Обновление после изменений в коде

```bash
git pull   # если используете git
docker compose up -d --build
```

Миграции применяются автоматически при каждом старте `backend` (см. `backend/Dockerfile`), повторное применение безопасно — используется `CREATE TABLE IF NOT EXISTS`.

### Бэкап базы данных

```bash
docker compose exec postgres pg_dump -U planner planner > backup.sql
```

Восстановление:
```bash
cat backup.sql | docker compose exec -T postgres psql -U planner planner
```

## Локальная разработка (без Docker)

Нужны Node.js 20+ и локальный/удалённый PostgreSQL.

**Backend:**
```bash
cd backend
cp .env.example .env    # укажите свой DATABASE_URL
npm install
npm run migrate         # применить миграции
npm run dev              # http://localhost:4000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev              # http://localhost:5173, /api проксируется на localhost:4000
```

## Как устроена основная логика

- **Категории** — таблица `categories`, привязаны к пользователю. При регистрации создаются 3 стандартные («Работа», «Личное», «Привычки»), новые можно добавлять на странице (в API уже есть `POST /api/categories` — фронтенд для добавления категорий из UI можно доделать позже, сейчас управление через шаблоны/задачи использует уже существующие).
- **Шаблоны** (`template_items`) — отдельные списки для `weekday` и `weekend`. При первом открытии дня (`GET /api/days/:date`) backend смотрит, будний это день или выходной, и копирует туда пункты шаблона как задачи.
- **Перенос задач** — при переносе (`POST /api/tasks/:id/move`) задача физически переезжает в новый день (`tasks.day_id` меняется), а в таблицу `task_moves` пишется запись «откуда → куда». На старом дне это отображается как отдельная неактивная строка «перенесено на …», сама запись из истории никогда не удаляется.
- **Аналитика** считает задачи, реально находящиеся в днях диапазona (выполнено/невыполнено), плюс отдельно — сколько задач было перенесено из дней этого диапазона, с разбивкой по категориям.

## Что можно добавить дальше

- Управление категориями (добавление/удаление/цвет) прямо из интерфейса — API уже готово.
- Повторяющиеся задачи с произвольным интервалом (не только «будни/выходные»).
- Push/email-напоминания о задачах с привязкой ко времени.
- Мобильное PWA-приложение (добавить `manifest.json` и service worker — Vite это легко поддерживает).
