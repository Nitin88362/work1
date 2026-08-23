const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'campaign.db');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const sessions = new Map();
const rateBuckets = new Map();

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error('ADMIN_PASSWORD environment variable must be at least 12 characters.');
  process.exit(1);
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const db = new sqlite3.Database(DB_PATH);
db.run(`CREATE TABLE IF NOT EXISTS selfies (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT NOT NULL UNIQUE, mime_type TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL, ip_hash TEXT)`);
app.disable('x-powered-by');
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

function cookieValue(req, name) {
  const match = (req.headers.cookie || '').match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}
function requireAdmin(req, res, next) {
  const session = sessions.get(cookieValue(req, 'admin_session'));
  if (!session || session < Date.now()) return res.status(401).json({ error: 'Login required' });
  next();
}
function rateLimit(name, maxRequests, windowMs) {
  return (req, res, next) => {
    const key = `${name}:${req.ip}`; const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) { rateBuckets.set(key, { count: 1, resetAt: now + windowMs }); return next(); }
    bucket.count += 1;
    if (bucket.count > maxRequests) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    next();
  };
}
const dbAll = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
const dbRun = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (error) { error ? reject(error) : resolve({ id: this.lastID, changes: this.changes }); }));

app.post('/api/selfies', rateLimit('upload', 20, 60 * 60 * 1000), async (req, res) => {
  try {
    const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.image || '');
    if (!match) return res.status(400).json({ error: 'Valid JPEG or PNG image required' });
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'Image is too large' });
    const filename = `${Date.now()}-${crypto.randomBytes(10).toString('hex')}.${match[1] === 'image/png' ? 'png' : 'jpg'}`;
    const createdAt = new Date().toISOString();
    const ipHash = crypto.createHash('sha256').update(`${req.ip}|cyber-selfie`).digest('hex').slice(0, 16);
    await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), buffer, { flag: 'wx' });
    const record = await dbRun('INSERT INTO selfies(filename,mime_type,size,created_at,ip_hash) VALUES(?,?,?,?,?)', [filename, match[1], buffer.length, createdAt, ipHash]);
    res.status(201).json({ id: record.id, saved: true });
  } catch (error) { console.error('Selfie save failed:', error); res.status(500).json({ error: 'Selfie could not be saved' }); }
});

app.post('/api/admin/login', rateLimit('login', 10, 15 * 60 * 1000), (req, res) => {
  const expected = Buffer.from(ADMIN_PASSWORD); const actual = Buffer.from(String(req.body?.password || ''));
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return res.status(401).json({ error: 'Wrong password' });
  const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, Date.now() + 43200000);
  res.setHeader('Set-Cookie', `admin_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`); res.json({ ok: true });
});
app.post('/api/admin/logout', requireAdmin, (req, res) => { sessions.delete(cookieValue(req, 'admin_session')); res.setHeader('Set-Cookie', 'admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); res.json({ ok: true }); });
app.get('/api/admin/selfies', requireAdmin, async (_req, res) => { try { res.setHeader('Cache-Control', 'no-store'); res.json(await dbAll('SELECT id,size,created_at FROM selfies ORDER BY id DESC LIMIT 500')); } catch { res.status(500).json({ error: 'Records could not be loaded' }); } });
app.get('/api/admin/selfies/:id/image', requireAdmin, async (req, res) => { try { const rows = await dbAll('SELECT filename,mime_type FROM selfies WHERE id=?', [req.params.id]); if (!rows[0]) return res.status(404).end(); res.type(rows[0].mime_type).set('Cache-Control', 'private, no-store').sendFile(path.join(UPLOAD_DIR, rows[0].filename)); } catch { res.status(500).end(); } });
app.delete('/api/admin/selfies/:id', requireAdmin, async (req, res) => { try { const rows = await dbAll('SELECT filename FROM selfies WHERE id=?', [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Not found' }); await dbRun('DELETE FROM selfies WHERE id=?', [req.params.id]); await fs.promises.unlink(path.join(UPLOAD_DIR, rows[0].filename)).catch(() => {}); res.json({ ok: true }); } catch { res.status(500).json({ error: 'Delete failed' }); } });

app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('*', (_req, res) => res.status(404).send('Not found'));
app.listen(PORT, () => console.log(`Cyber selfie app running at http://localhost:${PORT}`));
