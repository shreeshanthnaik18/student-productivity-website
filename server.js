require('dotenv').config();
require('express-async-errors');
const path = require('path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;
const production = process.env.NODE_ENV === 'production';
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: production ? { rejectUnauthorized: false } : false
});

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(session({
  name: 'studymate.sid',
  secret: process.env.SESSION_SECRET || 'development-only-change-this-secret',
  resave: false,
  saveUninitialized: false,
  store: new PgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true }),
  cookie: { httpOnly: true, sameSite: 'lax', secure: production, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(60) NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS entries (
      id BIGSERIAL PRIMARY KEY,
      owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('task', 'class')),
      title VARCHAR(180) NOT NULL,
      day TEXT NOT NULL DEFAULT '' CHECK (day IN ('', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
      class_start TIME,
      class_end TIME,
      room VARCHAR(100) NOT NULL DEFAULT '',
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      due_date DATE,
      remind_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK ((kind = 'class' AND day <> '' AND class_start IS NOT NULL AND class_end IS NOT NULL) OR kind = 'task')
    );
    CREATE INDEX IF NOT EXISTS entries_owner_kind_idx ON entries(owner_id, kind);
  `);
}

function requireUser(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}
function setSessionUser(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(error => {
      if (error) return reject(error);
      req.session.userId = String(userId);
      req.session.save(saveError => saveError ? reject(saveError) : resolve());
    });
  });
}
const entryFields = `id::text AS "_id", kind, title, day,
  COALESCE(to_char(class_start, 'HH24:MI'), '') AS start,
  COALESCE(to_char(class_end, 'HH24:MI'), '') AS end,
  room, completed, COALESCE(due_date::text, '') AS "dueDate", remind_at AS "remindAt"`;
async function findEntry(id, ownerId) {
  const result = await pool.query(`SELECT ${entryFields} FROM entries WHERE id = $1 AND owner_id = $2`, [id, ownerId]);
  return result.rows[0];
}

const api = express.Router();
api.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, database: 'connected' });
});
api.post('/auth/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return res.status(400).json({ error: 'Enter your name, a valid email, and a password with at least 8 characters.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, await bcrypt.hash(password, 12)]
    );
    const user = result.rows[0];
    await setSessionUser(req, user.id);
    res.status(201).json({ user: { name: user.name, email: user.email } });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account already uses that email.' });
    throw error;
  }
});
api.post('/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const result = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.password_hash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  await setSessionUser(req, user.id);
  res.json({ user: { name: user.name, email: user.email } });
});
api.post('/auth/logout', (req, res) => req.session.destroy(() => { res.clearCookie('studymate.sid'); res.json({ ok: true }); }));
api.get('/auth/me', requireUser, async (req, res) => {
  const result = await pool.query('SELECT name, email FROM users WHERE id = $1', [req.session.userId]);
  if (!result.rows[0]) return res.status(401).json({ error: 'Please sign in.' });
  res.json({ user: result.rows[0] });
});
api.get('/entries', requireUser, async (req, res) => {
  const kind = ['task', 'class'].includes(req.query.kind) ? req.query.kind : null;
  const result = await pool.query(
    `SELECT ${entryFields} FROM entries WHERE owner_id = $1 AND ($2::text IS NULL OR kind = $2) ORDER BY created_at DESC`,
    [req.session.userId, kind]
  );
  res.json({ entries: result.rows });
});
api.post('/entries', requireUser, async (req, res) => {
  const { kind, title, day = '', start = '', end = '', room = '', dueDate = '', remindAt = '' } = req.body;
  if (!['task', 'class'].includes(kind) || !String(title || '').trim()) {
    return res.status(400).json({ error: 'A valid entry type and title are required.' });
  }
  if (kind === 'class' && (!day || !start || !end || start >= end)) {
    return res.status(400).json({ error: 'Choose a day and valid start and end times.' });
  }
  if (kind === 'class') {
    const overlap = await pool.query(
      'SELECT 1 FROM entries WHERE owner_id = $1 AND kind = $2 AND day = $3 AND class_start < $5::time AND class_end > $4::time LIMIT 1',
      [req.session.userId, kind, day, start, end]
    );
    if (overlap.rowCount) return res.status(409).json({ error: 'This class overlaps another class on that day.' });
  }
  const result = await pool.query(
    `INSERT INTO entries (owner_id, kind, title, day, class_start, class_end, room, due_date, remind_at)
     VALUES ($1, $2, $3, $4, NULLIF($5, '')::time, NULLIF($6, '')::time, $7, NULLIF($8, '')::date, NULLIF($9, '')::timestamptz)
     RETURNING id`,
    [req.session.userId, kind, String(title).trim(), day || '', start || '', end || '', room || '', dueDate || '', remindAt || '']
  );
  res.status(201).json({ entry: await findEntry(result.rows[0].id, req.session.userId) });
});
api.patch('/entries/:id', requireUser, async (req, res) => {
  const result = await pool.query(
    'UPDATE entries SET completed = $1 WHERE id = $2 AND owner_id = $3 AND kind = $4 RETURNING id',
    [Boolean(req.body.completed), req.params.id, req.session.userId, 'task']
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Task not found.' });
  res.json({ entry: await findEntry(result.rows[0].id, req.session.userId) });
});
api.delete('/entries/:id', requireUser, async (req, res) => {
  const result = await pool.query('DELETE FROM entries WHERE id = $1 AND owner_id = $2', [req.params.id, req.session.userId]);
  if (!result.rowCount) return res.status(404).json({ error: 'Entry not found.' });
  res.json({ ok: true });
});

app.use('/api', api);
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

async function start() {
  if (!databaseUrl) throw new Error('DATABASE_URL is required. Configure PostgreSQL before starting StudyMate.');
  if (production && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET must be set in production.');
  await pool.query('SELECT 1');
  await initializeDatabase();
  app.listen(PORT, '0.0.0.0', () => console.log(`StudyMate is running on port ${PORT}`));
}
start().catch(error => { console.error('Could not start StudyMate. Check DATABASE_URL.', error.message); process.exit(1); });
