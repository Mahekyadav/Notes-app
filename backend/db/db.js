const { Pool } = require('pg');

const dbUrl = (process.env.DATABASE_URL || '').trim();
console.log('[DB] DATABASE_URL set:', !!dbUrl);
if (dbUrl) console.log('[DB] URL starts with:', dbUrl.substring(0, 40) + '...');

const pool = new Pool(
  dbUrl
    ? { connectionString: dbUrl, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'notes_app',
      }
);

module.exports = pool;
