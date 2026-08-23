const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { put, list, get, del } = require('@vercel/blob');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;
const rateBuckets = new Map();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

function configured(res) {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12 || !SESSION_SECRET || SESSION_SECRET.length < 32) {
    res.status(503).json({ error: 'Server environment variables are not configured' }); return false;
  }
  return true;
}
function cookieValue(req, name) {
  const match = (req.headers.cookie || '').match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}
function sign(value) { return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url'); }
function createSession() { const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 43200000 })).toString('base64url'); return `${payload}.${sign(payload)}`; }
function validSession(token) {
  if (!token || !SESSION_SECRET) return false;
  const [payload, signature] = token.split('.'); if (!payload || !signature) return false;
  const expected = Buffer.from(sign(payload)); const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}
function requireAdmin(req, res, next) {
  if (!configured(res)) return;
  if (!validSession(cookieValue(req, 'admin_session'))) return res.status(401).json({ error: 'Login required' });
  next();
}
function rateLimit(name, maxRequests, windowMs) {
  return (req, res, next) => {
    const key = `${name}:${req.ip}`; const now = Date.now(); const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) { rateBuckets.set(key, { count: 1, resetAt: now + windowMs }); return next(); }
    if (++bucket.count > maxRequests) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    next();
  };
}

app.post('/api/selfies', rateLimit('upload', 20, 3600000), async (req, res) => {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Private Blob storage is not connected' });
    const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.image || '');
    if (!match) return res.status(400).json({ error: 'Valid JPEG or PNG image required' });
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'Image is too large' });
    const extension = match[1] === 'image/png' ? 'png' : 'jpg';
    const pathname = `selfies/${Date.now()}-${crypto.randomBytes(12).toString('hex')}.${extension}`;
    const blob = await put(pathname, buffer, { access: 'private', contentType: match[1], addRandomSuffix: false });
    res.status(201).json({ id: encodeURIComponent(blob.pathname), saved: true });
  } catch (error) { console.error('Selfie save failed:', error); res.status(500).json({ error: 'Selfie could not be saved' }); }
});

app.post('/api/admin/login', rateLimit('login', 10, 900000), (req, res) => {
  if (!configured(res)) return;
  const expected = Buffer.from(ADMIN_PASSWORD); const actual = Buffer.from(String(req.body?.password || ''));
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return res.status(401).json({ error: 'Wrong password' });
  res.setHeader('Set-Cookie', `admin_session=${createSession()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.VERCEL ? '; Secure' : ''}`); res.json({ ok: true });
});
app.post('/api/admin/logout', requireAdmin, (_req, res) => { res.setHeader('Set-Cookie', `admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.VERCEL ? '; Secure' : ''}`); res.json({ ok: true }); });
app.get('/api/admin/selfies', requireAdmin, async (_req, res) => {
  try {
    const result = await list({ prefix: 'selfies/', limit: 500 });
    const records = result.blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).map(blob => ({ id: encodeURIComponent(blob.pathname), size: blob.size, created_at: blob.uploadedAt }));
    res.setHeader('Cache-Control', 'private, no-store'); res.json(records);
  } catch { res.status(500).json({ error: 'Records could not be loaded' }); }
});
app.get('/api/admin/selfies/:id/image', requireAdmin, async (req, res) => {
  try {
    const pathname = decodeURIComponent(req.params.id); if (!pathname.startsWith('selfies/')) return res.status(400).end();
    const result = await get(pathname, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) return res.status(404).end();
    res.type(result.blob.contentType).set({ 'Cache-Control': 'private, no-store', 'Content-Length': String(result.blob.size) });
    Readable.fromWeb(result.stream).pipe(res);
  } catch { res.status(500).end(); }
});
app.delete('/api/admin/selfies/:id', requireAdmin, async (req, res) => {
  try { const pathname = decodeURIComponent(req.params.id); if (!pathname.startsWith('selfies/')) return res.status(400).json({ error: 'Invalid id' }); await del(pathname); res.json({ ok: true }); }
  catch { res.status(500).json({ error: 'Delete failed' }); }
});

app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('*', (_req, res) => res.status(404).send('Not found'));

module.exports = app;
if (require.main === module) app.listen(PORT, () => console.log(`Cyber selfie app running at http://localhost:${PORT}`));
