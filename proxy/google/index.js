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
  'https://pogadaj.se',
  'https://www.pogadaj.se',
  'https://pogadaj.com.pl',
  'https://www.pogadaj.com.pl',
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

// Dokument konta = adres email (czytelny na liście w konsoli Firestore).
// Kiedyś był to hash SHA-256; migracja (migrate-users.js) przenosi stare konta.
function userDocId(email) {
  return String(email).trim().toLowerCase();
}

// Kolejny numer konta (000001, 000002…) — atomowy licznik w meta/counters.
// Transform „increment" tworzy dokument i pole, gdy jeszcze nie istnieją.
async function nextUserNumber() {
  const [token, project] = await Promise.all([gcpToken(), gcpProject()]);
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:commit`;
  const body = { writes: [{
    transform: {
      document: `projects/${project}/databases/(default)/documents/meta/counters`,
      fieldTransforms: [{ fieldPath: 'userSeq', increment: { integerValue: '1' } }],
    },
  }] };
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('Firestore counter ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const d = await r.json();
  const n = Number(d.writeResults?.[0]?.transformResults?.[0]?.integerValue || 0);
  return String(n).padStart(6, '0');
}

async function fsGetUser(email) {
  const [token, project] = await Promise.all([gcpToken(), gcpProject()]);
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${encodeURIComponent(userDocId(email))}`;
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Firestore GET ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const d = await r.json();
  const f = d.fields || {};
  return {
    id: f.id?.stringValue || '',
    number: f.number?.stringValue || '',     // kolejny numer konta (000001…)
    name: f.name?.stringValue || '',
    email: f.email?.stringValue || '',
    salt: f.salt?.stringValue || '',
    hash: f.hash?.stringValue || '',
    profile: f.profile?.stringValue || '',   // profil fonetyczny (JSON)
    state: f.state?.stringValue || '',       // postępy ucznia (poziom, historia, czas) — JSON
    createdAt: f.createdAt?.stringValue || '',
  };
}

// mapStringValue helper — Firestore wymaga pełnych obiektów pól przy PATCH,
// więc zachowujemy dotychczasowe wartości (state/profile) gdy ich nie zmieniamy.

async function fsPutUser(u) {
  const [token, project] = await Promise.all([gcpToken(), gcpProject()]);
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${encodeURIComponent(userDocId(u.email))}`;
  const body = { fields: {
    id: { stringValue: u.id || '' },
    number: { stringValue: u.number || '' },
    name: { stringValue: u.name },
    email: { stringValue: u.email },
    salt: { stringValue: u.salt },
    hash: { stringValue: u.hash },
    profile: { stringValue: u.profile || '' },
    state: { stringValue: u.state || '' },
    // Zachowaj pierwotną datę utworzenia — nie nadpisuj przy każdym zapisie stanu.
    createdAt: { stringValue: u.createdAt || new Date().toISOString() },
  } };
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('Firestore PUT ' + r.status + ': ' + (await r.text()).slice(0, 200));
}

async function fsDeleteUser(email) {
  const [token, project] = await Promise.all([gcpToken(), gcpProject()]);
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${encodeURIComponent(userDocId(email))}`;
  const r = await fetch(url, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok && r.status !== 404) throw new Error('Firestore DELETE ' + r.status + ': ' + (await r.text()).slice(0, 200));
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

function verifyToken(tok, email) {
  try {
    const [em, exp, sig] = Buffer.from(String(tok), 'base64url').toString().split('|');
    if (em !== email || Date.now() > Number(exp)) return false;
    const good = crypto.createHmac('sha256', sessionSecret()).update(`${em}|${exp}`).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
  } catch { return false; }
}

// Hasło: min 8 znaków, wielka litera, znak specjalny
function passwordProblem(p) {
  if (typeof p !== 'string' || p.length < 8) return 'Hasło musi mieć co najmniej 8 znaków.';
  if (!/[A-ZĄĆĘŁŃÓŚŹŻ]/.test(p)) return 'Hasło musi zawierać wielką literę.';
  if (!/[^A-Za-z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(p)) return 'Hasło musi zawierać znak specjalny.';
  return null;
}

// Wysyłka opinii MAILEM na izabela@izabelacode.pl (przez Resend API).
// Działa, gdy ustawiony jest sekret RESEND_KEY; bez niego pomijamy (zostaje
// zapis w Firestore). FROM/TO można nadpisać zmiennymi FEEDBACK_FROM/FEEDBACK_TO.
async function sendFeedbackEmail(entry) {
  const to = process.env.FEEDBACK_TO || 'izabela@izabelacode.pl';
  const sig = entry.name ? entry.name : 'Anonim';
  const subject = `Opinia z pogadaj.se — ${sig}`;
  const lines = [
    `Podpis: ${sig}`,
    entry.email ? `Konto (email): ${entry.email}` : 'Konto: (brak / gość)',
    entry.page ? `Ekran: ${entry.page}` : '',
    '',
    entry.text,
  ].filter((l) => l !== '').join('\n');

  // 1) SMTP (np. Gmail dla izabela@izabelacode.pl) — gdy podane dane SMTP
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const from = process.env.FEEDBACK_FROM || process.env.SMTP_USER;
    await transporter.sendMail({ from, to, subject, text: lines, replyTo: entry.email || undefined });
    return { sent: true, via: 'smtp' };
  }

  // 2) Resend (zapasowo, gdy ustawiony RESEND_KEY)
  if (process.env.RESEND_KEY) {
    const from = process.env.FEEDBACK_FROM || 'Pogadaj.se <onboarding@resend.dev>';
    const body = { from, to: [to], subject, text: lines };
    if (entry.email) body.reply_to = entry.email;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('Resend ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return { sent: true, via: 'resend' };
  }

  return { sent: false, reason: 'no mail config' };
}

// Opinia użytkownika — zapis do Firestore (kolekcja feedback) jako trwały ślad.
async function fsAddFeedback(entry) {
  const [token, project] = await Promise.all([gcpToken(), gcpProject()]);
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/feedback`;
  const body = { fields: {
    to: { stringValue: 'izabela@izabelacode.pl' },
    email: { stringValue: entry.email || '' },
    name: { stringValue: entry.name || '' },
    page: { stringValue: entry.page || '' },
    text: { stringValue: entry.text || '' },
    createdAt: { stringValue: new Date().toISOString() },
  } };
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('Firestore feedback ' + r.status + ': ' + (await r.text()).slice(0, 200));
}

async function handleAuth(path, body, res) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Podaj poprawny adres email.' });

  if (path === '/auth/register') {
    const name = String(body.name || '').trim().slice(0, 40);   // imię dołącza po filmie
    const pp = passwordProblem(password);
    if (pp) return res.status(400).json({ error: pp });
    if (await fsGetUser(email)) return res.status(409).json({ error: 'Konto z tym adresem już istnieje. Zaloguj się.' });
    const salt = crypto.randomBytes(16).toString('hex');
    const id = crypto.randomUUID();                       // unikalne ID użytkownika
    const number = await nextUserNumber();                // kolejny numer konta (000001…)
    await fsPutUser({ id, number, name, email, salt, hash: hashPassword(password, salt) });
    return res.status(200).json({ ok: true, id, number, name, email, token: makeToken(email) });
  }

  if (path === '/auth/setname') {
    const name = String(body.name || '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: 'Podaj imię.' });
    if (!verifyToken(body.token, email)) return res.status(401).json({ error: 'Sesja wygasła. Zaloguj się ponownie.' });
    const u = await fsGetUser(email);
    if (!u) return res.status(404).json({ error: 'Nie ma takiego konta.' });
    await fsPutUser({ ...u, name });
    return res.status(200).json({ ok: true, name });
  }

  if (path === '/auth/login') {
    const u = await fsGetUser(email);
    if (!u || hashPassword(password, u.salt) !== u.hash) {
      return res.status(401).json({ error: 'Zły email albo hasło.' });
    }
    let profile = null, state = null;
    try { profile = u.profile ? JSON.parse(u.profile) : null; } catch {}
    try { state = u.state ? JSON.parse(u.state) : null; } catch {}
    return res.status(200).json({ ok: true, id: u.id, number: u.number, name: u.name, email: u.email, token: makeToken(email), profile, state });
  }

  // Zmiana emaila: konto przenosi się pod nowy adres (dokument = adres email),
  // stary dokument znika, klient dostaje świeży token na nowy adres.
  if (path === '/auth/setemail') {
    const newEmail = String(body.newEmail || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) return res.status(400).json({ error: 'Podaj poprawny nowy adres email.' });
    if (!verifyToken(body.token, email)) return res.status(401).json({ error: 'Sesja wygasła. Zaloguj się ponownie.' });
    const u = await fsGetUser(email);
    if (!u) return res.status(404).json({ error: 'Nie ma takiego konta.' });
    if (newEmail !== email && await fsGetUser(newEmail)) return res.status(409).json({ error: 'Konto z tym adresem już istnieje.' });
    await fsPutUser({ ...u, email: newEmail });
    if (newEmail !== email) await fsDeleteUser(email);
    return res.status(200).json({ ok: true, email: newEmail, token: makeToken(newEmail) });
  }

  // Zmiana hasła: wymaga obecnego hasła, nowe przechodzi te same reguły
  if (path === '/auth/setpassword') {
    if (!verifyToken(body.token, email)) return res.status(401).json({ error: 'Sesja wygasła. Zaloguj się ponownie.' });
    const u = await fsGetUser(email);
    if (!u || hashPassword(String(body.password || ''), u.salt) !== u.hash) {
      return res.status(401).json({ error: 'Obecne hasło się nie zgadza.' });
    }
    const pp = passwordProblem(String(body.newPassword || ''));
    if (pp) return res.status(400).json({ error: pp });
    const salt = crypto.randomBytes(16).toString('hex');
    await fsPutUser({ ...u, salt, hash: hashPassword(String(body.newPassword), salt) });
    return res.status(200).json({ ok: true });
  }

  // Profil fonetyczny — Izabela zapamiętuje problemy z wymową na koncie
  if (path === '/profile/save') {
    if (!verifyToken(body.token, email)) return res.status(401).json({ error: 'Sesja wygasła. Zaloguj się ponownie.' });
    const u = await fsGetUser(email);
    if (!u) return res.status(404).json({ error: 'Nie ma takiego konta.' });
    const profile = JSON.stringify(body.profile || {}).slice(0, 20000);
    await fsPutUser({ ...u, profile });
    return res.status(200).json({ ok: true });
  }

  // Postępy ucznia (poziom, historia lekcji, wykorzystany czas) — zapis na koncie
  if (path === '/state/save') {
    if (!verifyToken(body.token, email)) return res.status(401).json({ error: 'Sesja wygasła. Zaloguj się ponownie.' });
    const u = await fsGetUser(email);
    if (!u) return res.status(404).json({ error: 'Nie ma takiego konta.' });
    const state = JSON.stringify(body.state || {}).slice(0, 200000);
    await fsPutUser({ ...u, state });
    return res.status(200).json({ ok: true });
  }

  return res.status(404).json({ error: 'unknown auth path' });
}

exports.geminiProxy = async (req, res) => {
  // Odbijamy KAŻDY origin (http i https, dowolna domena) — auth jest na tokenach,
  // nie na ciasteczkach, więc to bezpieczne, a nie blokuje pogadaj.com.pl po HTTP.
  const origin = req.headers.origin || '';
  res.set('Access-Control-Allow-Origin', origin || '*');
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const path = (req.path || '').replace(/^\/+/, '/');

  // Opinie użytkowników
  if (path === '/feedback') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const text = String(body.text || '').trim().slice(0, 4000);
      if (!text) return res.status(400).json({ error: 'Pusta opinia.' });
      const entry = { email: String(body.email || '').slice(0, 120), name: String(body.name || '').slice(0, 60), page: String(body.page || '').slice(0, 60), text };
      await fsAddFeedback(entry);                       // trwały zapis (zawsze)
      try { await sendFeedbackEmail(entry); }           // mail best-effort (gdy jest RESEND_KEY)
      catch (e) { console.error('[feedback-mail]', e); }
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[feedback]', e);
      return res.status(500).json({ error: 'Nie udało się zapisać opinii.' });
    }
  }

  // Konta użytkowników
  if (path === '/auth/register' || path === '/auth/login' || path === '/auth/setname'
      || path === '/auth/setemail' || path === '/auth/setpassword'
      || path === '/profile/save' || path === '/state/save') {
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
