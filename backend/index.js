require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

async function initDB() {
  const db = require('./db/db');

  // On local dev: create the database if it doesn't exist
  // On cloud (Aiven/etc): DB is pre-created, skip this step
  if (process.env.DB_SSL !== 'true') {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
    });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'notes_app'}\``);
    console.log(`Database '${process.env.DB_NAME}' ready.`);
    await conn.end();
  }

  // Run schema — CREATE TABLE IF NOT EXISTS is safe to run every time
  const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    await db.query(stmt);
  }
  console.log('Tables initialized.');
}

// Mount routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/tags', require('./routes/tags'));

// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Notes app server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });
