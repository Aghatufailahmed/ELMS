// server.js — EduFlow LMS main entry point
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const path    = require('path');

process.env.JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || !JWT_SECRET.trim()) {
  throw new Error('JWT_SECRET is required. Set it in the environment or your local .env file.');
}
if (process.env.NODE_ENV === 'production' &&
    (JWT_SECRET.length < 32 || JWT_SECRET === 'replace-this-with-a-random-secret-of-at-least-32-characters')) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}

// Init DB (creates tables / defaults on first run)
require('./config/db');

const app = express();

// ── Middleware ────────────────────────────────────────
app.disable('x-powered-by');
app.set('trust proxy', 1);
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
if (allowedOrigins.length) {
  app.use(cors({ origin: allowedOrigins }));
}
app.use(express.json({ strict: true, limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── API Routes ───────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/courses',     require('./routes/courses'));
app.use('/api/instructors', require('./routes/instructors'));
app.use('/api/students',    require('./routes/students'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/analytics',   require('./routes/analytics'));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'eduflow-lms', timestamp: new Date().toISOString() });
});

// ── Frontend page routing ────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Static frontend ──────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), { index: false, maxAge: '1h' }));

// ── Global error handler ─────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong' });
});

// ── Start server ─────────────────────────────────────
const PORT = Number(process.env.PORT) || 5000;
let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`\n  EduFlow LMS running at http://localhost:${PORT}\n`);
  });
}

module.exports = { app, server, JWT_SECRET };
