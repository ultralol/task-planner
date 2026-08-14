const { Pool, types } = require('pg');

// Postgres DATE (OID 1082) отдаём как строку 'YYYY-MM-DD', а не JS Date:
// иначе pg парсит дату в локальную полночь, и при сериализации в JSON (UTC)
// она «съезжает» на день назад в зонах с положительным смещением (например +3).
// Это соответствует конвенции проекта: даты везде — строки YYYY-MM-DD.
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(1);
});

module.exports = { pool };
