// =============================================================
//  pogadaj.se — proxy do Gemini (Cloudflare Worker)
// -------------------------------------------------------------
//  Po co: żeby KAŻDY użytkownik miał Gemini (rozmowa + głos) od
//  startu, BEZ wklejania własnego klucza. Klucz siedzi tutaj, po
//  stronie serwera (jako sekret GEMINI_KEY) — przeglądarka woła
//  ten Worker bez klucza.
//
//  Wdrożenie (skrót — pełna instrukcja w proxy/README.md):
//    1. https://dash.cloudflare.com → Workers & Pages → Create → Worker
//    2. Wklej ten plik jako kod Workera i Deploy
//    3. Settings → Variables → "Add" sekret:  GEMINI_KEY = <twój klucz Gemini>
//    4. Skopiuj adres Workera (np. https://pogadajse-proxy.xxx.workers.dev)
//    5. Wpisz go w js/config.js → CONFIG.GEMINI.proxyBase
// =============================================================

const API = 'https://generativelanguage.googleapis.com';

// Skąd wolno wołać proxy (CORS + ochrona przed obcym ruchem).
// Dopisz tu swoje domeny; pusta tablica = każdy origin (NIEzalecane na produkcji).
const ALLOW_ORIGINS = [
  'https://ipawlak00.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors);

    if (ALLOW_ORIGINS.length && origin && !ALLOW_ORIGINS.includes(origin)) {
      return json({ error: 'origin not allowed' }, 403, cors);
    }

    const url = new URL(request.url);
    // Wpuszczamy WYŁĄCZNIE generateContent na modele Gemini (czat + TTS)
    if (!/^\/v1beta\/models\/[A-Za-z0-9.\-]+:generateContent$/.test(url.pathname)) {
      return json({ error: 'forbidden path' }, 403, cors);
    }
    if (!env.GEMINI_KEY) return json({ error: 'GEMINI_KEY not configured on proxy' }, 500, cors);

    const target = `${API}${url.pathname}?key=${env.GEMINI_KEY}`;
    const upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: await request.text(),
    });

    // Przekazujemy odpowiedź 1:1 (z nagłówkami CORS)
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
    });
  },
};

function corsHeaders(origin) {
  const allowed = !ALLOW_ORIGINS.length || ALLOW_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': allowed && origin ? origin : (ALLOW_ORIGINS[0] || '*'),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
