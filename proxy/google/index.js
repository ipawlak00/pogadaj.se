// =============================================================
//  pogadaj.se — proxy do Gemini (Google Cloud Function, gen 2)
// -------------------------------------------------------------
//  Trzyma klucz Gemini po stronie Google (sekret GEMINI_KEY) i
//  przekazuje zapytania do generativelanguage.googleapis.com.
//  Dzięki temu KAŻDY użytkownik ma rozmowę i głos Gemini bez
//  wklejania klucza — a wszystkie opłaty są w jednym projekcie Google.
//
//  Deploy (gcloud):
//    gcloud functions deploy gemini-proxy \
//      --gen2 --runtime=nodejs20 --region=europe-central2 \
//      --source=. --entry-point=geminiProxy \
//      --trigger-http --allow-unauthenticated \
//      --set-secrets=GEMINI_KEY=GEMINI_KEY:latest
//  (Sekret GEMINI_KEY utwórz w Secret Manager; włącz Generative Language API.)
//
//  Po deployu skopiuj URL funkcji i wpisz go w js/config.js → proxyBase.
// =============================================================

const API = 'https://generativelanguage.googleapis.com';

const ALLOW_ORIGINS = [
  'https://ipawlak00.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];

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

  // Wpuszczamy WYŁĄCZNIE generateContent na modele Gemini (czat + TTS)
  const path = (req.path || '').replace(/^\/+/, '/');
  if (!/^\/v1beta\/models\/[A-Za-z0-9.\-]+:generateContent$/.test(path)) {
    return res.status(403).json({ error: 'forbidden path' });
  }
  if (!process.env.GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_KEY not configured' });

  try {
    const upstream = await fetch(`${API}${path}?key=${process.env.GEMINI_KEY}`, {
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
