// =============================================================
//  pogadaj.se — backend (Google Cloud Function, gen 2)
// -------------------------------------------------------------
//  1) Proxy do Gemini i Cloud Text-to-Speech (klucze w Secret Manager)
//  2) Konta użytkowników: rejestracja + logowanie
//     - baza: Firestore (ta sama usługa Google, zero dodatkowych kluczy —
//       funkcja używa swojego konta usługi)
//     - hasła: scrypt z solą (nigdy czystym tekstem)
//
//  Wymagane (jednorazowo, Cloud Shell):
//    gcloud services enable firestore.googleapis.com
//    gcloud firestore databases create --location=europe-central2
//    gcloud projects add-iam-policy-binding vertical-album-498418-j3 \
//      --member=serviceAccount:1008153683515-compute@developer.gserviceaccount.com \
//      --role=roles/datastore.user
// =============================================================

const crypto = require('crypto');

const API = 'https://generativelanguage.googleapis.com';
const TTS_API = 'https://texttospeech.googleapis.com';

const ALLOW_ORIGINS = [
  'https://ipawlak00.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];

// ---- Firestore przez REST (token z metadata server Cloud Run) ----
let cachedToken = null, cachedTokenExp = 0, cachedProject = null;

async function gcpToken() {
  if (cachedToken && Date.now() < cachedTokenExp - 60000) return cachedToken;
  const r = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' } });
  const d = await r.json();
  cachedToken = d.access_token;
  cachedTokenExp = Date.now() + (d.expires_in || 3600) * 1000;
  return cachedToken;
}

async function gcpProject() {
  if (cachedProject) return cachedProject;
  const r = await fetch('http://metadata.google.internal/computeMetadata/v1/project/project-id',
    { headers: { 'Metadata-Flavor': 'Google' } });
  cachedProject = await r.text();
  return cachedProject;
}

function userDocId(email) {
  return crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex').slice(0, 32);
}

async function fsGetUser(email) {
  const [token, project] = await Promise.all([gcpToken(), gcpProject()]);
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${userDocId(email)}`;
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Firestore GET ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const d = await r.json();
  const f = d.fields || {};
  return {
    name: f.name?.stringValue || '',
    email: f.email?.stringValue || '',
    salt: f.salt?.stringValue || '',
    hash: f.hash?.stringValue || '',
  };
}

async function fsPutUser(u) {
  const [token, project] = await Promise.all([gcpToken(), gcpProject()]);
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${userDocId(u.email)}`;
  const body = { fields: {
    name: { stringValue: u.name },
    email: { stringValue: u.email },
    salt: { stringValue: u.salt },
    hash: { stringValue: u.hash },
    createdAt: { stringValue: new Date().toISOString() },
  } };
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('Firestore PUT ' + r.status + ': ' + (await r.text()).slice(0, 200));
}

// ---- hasła i tokeny sesji ----
const hashPassword = (password, salt) =>
  crypto.scryptSync(password, salt, 64).toString('hex');

function sessionSecret() { return process.env.GEMINI_KEY || 'pogadajse-dev'; }

function makeToken(email) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 90;   // 90 dni
  const payload = `${email}|${exp}`;
  const sig = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

// Hasło: min 8 znaków, wielka litera, znak specjalny
function passwordProblem(p) {
  if (typeof p !== 'string' || p.length < 8) return 'Hasło musi mieć co najmniej 8 znaków.';
  if (!/[A-ZĄĆĘŁŃÓŚŹŻ]/.test(p)) return 'Hasło musi zawierać wielką literę.';
  if (!/[^A-Za-z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(p)) return 'Hasło musi zawierać znak specjalny.';
  return null;
}

async function handleAuth(path, body, res) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Podaj poprawny adres email.' });

  if (path === '/auth/register') {
    const name = String(body.name || '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: 'Podaj imię.' });
    const pp = passwordProblem(password);
    if (pp) return res.status(400).json({ error: pp });
    if (await fsGetUser(email)) return res.status(409).json({ error: 'Konto z tym adresem już istnieje. Zaloguj się.' });
    const salt = crypto.randomBytes(16).toString('hex');
    await fsPutUser({ name, email, salt, hash: hashPassword(password, salt) });
    return res.status(200).json({ ok: true, name, email, token: makeToken(email) });
  }

  if (path === '/auth/login') {
    const u = await fsGetUser(email);
    if (!u || hashPassword(password, u.salt) !== u.hash) {
      return res.status(401).json({ error: 'Zły email albo hasło.' });
    }
    return res.status(200).json({ ok: true, name: u.name, email: u.email, token: makeToken(email) });
  }

  return res.status(404).json({ error: 'unknown auth path' });
}

exports.geminiProxy = async (req, res) => {
  const origin = req.headers.origin || '';
  const allowed = !ALLOW_ORIGINS.length || ALLOW_ORIGINS.includes(origin);
  res.set('Access-Control-Allow-Origin', allowed && origin ? origin : (ALLOW_ORIGINS[0] || '*'));
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (ALLOW_ORIGINS.length && origin && !allowed) return res.status(403).json({ error: 'origin not allowed' });

  const path = (req.path || '').replace(/^\/+/, '/');

  // Konta użytkowników
  if (path === '/auth/register' || path === '/auth/login') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      return await handleAuth(path, body, res);
    } catch (e) {
      console.error('[auth]', e);
      return res.status(500).json({ error: 'Błąd serwera przy logowaniu. Spróbuj za chwilę.' });
    }
  }

  // Proxy AI: Gemini (czat/transkrypcja/TTS zapasowy) + Cloud TTS (główny głos)
  const isGemini = /^\/v1beta\/models\/[A-Za-z0-9.\-]+:generateContent$/.test(path);
  const isTts = path === '/v1/text:synthesize';
  if (!isGemini && !isTts) return res.status(403).json({ error: 'forbidden path' });

  const key = isTts ? (process.env.GTTS_KEY || process.env.GEMINI_KEY) : process.env.GEMINI_KEY;
  if (!key) return res.status(500).json({ error: 'key not configured' });
  const base = isTts ? TTS_API : API;

  try {
    const upstream = await fetch(`${base}${path}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ error: 'upstream error', detail: String(e) });
  }
};
