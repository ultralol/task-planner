const { templateTypeForDate } = require('./date');

// Возвращает строку days, создавая её при необходимости (без генерации из шаблона)
async function getOrCreateBareDay(client, userId, dateStr) {
  const existing = await client.query(
    'SELECT id, date, is_generated, note FROM days WHERE user_id = $1 AND date = $2',
    [userId, dateStr]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const inserted = await client.query(
    'INSERT INTO days (user_id, date, is_generated) VALUES ($1, $2, false) RETURNING id, date, is_generated, note',
    [userId, dateStr]
  );
  return inserted.rows[0];
}

// Получает день; если он создаётся впервые — сразу заполняет задачами из типового расписания
async function getOrCreateDayWithGeneration(client, userId, dateStr) {
  const existing = await client.query(
    'SELECT id, date, is_generated, note, template_synced_at FROM days WHERE user_id = $1 AND date = $2',
    [userId, dateStr]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const day = (
    await client.query(
      `INSERT INTO days (user_id, date, is_generated, template_synced_at)
       VALUES ($1, $2, true, now())
       RETURNING id, date, is_generated, note, template_synced_at`,
      [userId, dateStr]
    )
  ).rows[0];

  await generateFromTemplate(client, userId, day);
  return day;
}

// Отметить, что шаблон пользователя (weekday/weekend) изменился — для показа кнопки
// «Обновить из шаблона» в уже существующих днях.
async function markTemplateChanged(db, userId, template) {
  await db.query(
    `INSERT INTO template_state (user_id, template, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id, template) DO UPDATE SET updated_at = now()`,
    [userId, template]
  );
}

async function generateFromTemplate(client, userId, day, { skipExistingTitles = null } = {}) {
  const type = templateTypeForDate(day.date instanceof Date ? day.date.toISOString().slice(0, 10) : day.date);
  const items = (
    await client.query(
      'SELECT category_id, title, time_from, time_to, note, remind, remind_minutes_before, sort_order FROM template_items WHERE user_id = $1 AND template = $2 ORDER BY sort_order, id',
      [userId, type]
    )
  ).rows;

  for (const item of items) {
    if (skipExistingTitles && skipExistingTitles.has(item.title.trim().toLowerCase())) continue;
    await client.query(
      `INSERT INTO tasks (user_id, day_id, category_id, title, time_from, time_to, note, remind, remind_minutes_before, source, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'template', $10)`,
      [
        userId,
        day.id,
        item.category_id,
        item.title,
        item.time_from,
        item.time_to,
        item.note,
        item.remind,
        item.remind_minutes_before,
        item.sort_order,
      ]
    );
  }
  return items.length;
}

module.exports = { getOrCreateBareDay, getOrCreateDayWithGeneration, generateFromTemplate, markTemplateChanged };
