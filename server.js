require('dotenv').config();
require('express-async-errors');
const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;
const production = process.env.NODE_ENV === 'production';

mongoose.set('strictQuery', true);
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });
const entrySchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['task', 'class'], required: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  day: { type: String, enum: ['', 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], default: '' },
  start: { type: String, default: '' }, end: { type: String, default: '' }, room: { type: String, default: '', maxlength: 100 },
  completed: { type: Boolean, default: false }, dueDate: { type: String, default: '' }, remindAt: { type: String, default: '' }
}, { timestamps: true });
const User = mongoose.model('User', userSchema);
const Entry = mongoose.model('Entry', entrySchema);

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(session({
  name: 'studymate.sid', secret: process.env.SESSION_SECRET || 'development-only-change-this-secret',
  resave: false, saveUninitialized: false,
  store: mongoUri ? MongoStore.create({ mongoUrl: mongoUri, collectionName: 'sessions' }) : undefined,
  cookie: { httpOnly: true, sameSite: 'lax', secure: production, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

const api = express.Router();
function requireUser(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}
api.get('/health', (_req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
api.post('/auth/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: 'Enter your name, a valid email, and a password with at least 8 characters.' });
    if (await User.exists({ email })) return res.status(409).json({ error: 'An account already uses that email.' });
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
    req.session.userId = user.id;
    res.status(201).json({ user: { name: user.name, email: user.email } });
  } catch (error) { res.status(500).json({ error: 'Could not create the account.' }); }
});
api.post('/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  req.session.userId = user.id;
  res.json({ user: { name: user.name, email: user.email } });
});
api.post('/auth/logout', (req, res) => req.session.destroy(() => { res.clearCookie('studymate.sid'); res.json({ ok: true }); }));
api.get('/auth/me', requireUser, async (req, res) => {
  const user = await User.findById(req.session.userId).select('name email');
  if (!user) return res.status(401).json({ error: 'Please sign in.' });
  res.json({ user });
});
api.get('/entries', requireUser, async (req, res) => {
  const filter = { owner: req.session.userId };
  if (['task','class'].includes(req.query.kind)) filter.kind = req.query.kind;
  res.json({ entries: await Entry.find(filter).sort({ createdAt: -1 }).lean() });
});
api.post('/entries', requireUser, async (req, res) => {
  const { kind, title, day = '', start = '', end = '', room = '', dueDate = '', remindAt = '' } = req.body;
  if (!['task','class'].includes(kind) || !String(title || '').trim()) return res.status(400).json({ error: 'A valid entry type and title are required.' });
  if (kind === 'class' && (!day || !start || !end || start >= end)) return res.status(400).json({ error: 'Choose a day and valid start and end times.' });
  if (kind === 'class') {
    const overlap = await Entry.exists({ owner: req.session.userId, kind, day, start: { $lt: end }, end: { $gt: start } });
    if (overlap) return res.status(409).json({ error: 'This class overlaps another class on that day.' });
  }
  const entry = await Entry.create({ owner: req.session.userId, kind, title: String(title).trim(), day, start, end, room, dueDate, remindAt });
  res.status(201).json({ entry });
});
api.patch('/entries/:id', requireUser, async (req, res) => {
  const entry = await Entry.findOneAndUpdate({ _id: req.params.id, owner: req.session.userId, kind: 'task' }, { completed: Boolean(req.body.completed) }, { new: true });
  if (!entry) return res.status(404).json({ error: 'Task not found.' });
  res.json({ entry });
});
api.delete('/entries/:id', requireUser, async (req, res) => {
  const entry = await Entry.findOneAndDelete({ _id: req.params.id, owner: req.session.userId });
  if (!entry) return res.status(404).json({ error: 'Entry not found.' });
  res.json({ ok: true });
});
app.use('/api', api);
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

async function start() {
  if (!mongoUri) throw new Error('MONGODB_URI is required. Copy .env.example to .env and configure MongoDB.');
  if (production && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET must be set in production.');
  await mongoose.connect(mongoUri);
  app.listen(PORT, () => console.log(`StudyMate is running on port ${PORT}`));
}
start().catch(error => { console.error('Could not start StudyMate. Check MONGODB_URI.', error.message); process.exit(1); });
