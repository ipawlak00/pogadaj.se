// =============================================================
//  pogadaj.se — Konfiguracja globalna
// -------------------------------------------------------------
//  To jest JEDYNE miejsce, w którym przełączamy aplikację z trybu
//  lokalnego (stub) na realny backend. Gdy będziemy mieć klucze:
//    1. AI_PROVIDER = 'gemini' + wklej GEMINI_API_KEY (lub przez proxy)
//    2. AUTH_PROVIDER / DB_PROVIDER = 'firebase' + uzupełnij FIREBASE
//  Reszta aplikacji NIE wymaga zmian — usługi są za abstrakcją.
// =============================================================

export const CONFIG = {
  appName: 'pogadaj.se',
  version: '0.1.0',

  // --- Silnik AI -------------------------------------------------
  // 'stub'   -> logika lokalna, działa bez internetu/kluczy (DOMYŚLNIE)
  // 'gemini' -> realne Gemini API (wymaga klucza / proxy)
  AI_PROVIDER: 'stub',
  GEMINI: {
    apiKey: '',                 // NIE commitujemy klucza do repo (zostanie unieważniony)!
    model: 'gemini-2.5-flash',
    ttsModel: 'gemini-2.5-flash-preview-tts',
    // ZALECANE dla wszystkich użytkowników bez wklejania klucza:
    // wdróż proxy (np. Cloudflare Worker z proxy/cloudflare-worker.js),
    // które trzyma klucz po stronie serwera, i wpisz tu jego adres, np.
    //   proxyBase: 'https://pogadajse-proxy.twoj-subdomena.workers.dev'
    // Wtedy przeglądarka woła proxy BEZ klucza, a Gemini działa u każdego od startu.
    proxyBase: '',
    proxyUrl: '',               // (legacy) pełny URL tylko dla modelu czatu
  },

  // --- Uwierzytelnianie -----------------------------------------
  // 'local'    -> użytkownik trzymany w localStorage (DOMYŚLNIE)
  // 'firebase' -> Firebase Auth (Google Sign-In)
  AUTH_PROVIDER: 'local',

  // --- Baza danych ----------------------------------------------
  // 'local'    -> localStorage (DOMYŚLNIE)
  // 'firebase' -> Cloud Firestore
  DB_PROVIDER: 'local',

  FIREBASE: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },

  // --- Mowa (Web Speech API) ------------------------------------
  SPEECH: {
    recognitionLang: 'en-US',   // język rozpoznawania (uczeń mówi po angielsku)
    ttsLang: 'en-US',           // głos Izabeli podczas anglojęzycznych fraz
    ttsLangPL: 'pl-PL',         // głos Izabeli przy tłumaczeniu/korekcie po polsku
  },

  // --- Reguły biznesowe -----------------------------------------
  FREE_LESSONS: 3,              // 3 darmowe lekcje (haczyk)
  PHONETIC_WORDS_COUNT: 20,     // ile słówek w Paszporcie Fonetycznym (15–50)
};

// Czy Gemini jest dostępne (proxy dla wszystkich LUB klucz lokalny/użytkownika)
export const geminiConfigured = () =>
  !!(CONFIG.GEMINI.proxyBase || CONFIG.GEMINI.apiKey);

// Buduje URL do generateContent: przez proxy (bez klucza) albo wprost (z kluczem)
export function genContentUrl(model, key) {
  const base = (CONFIG.GEMINI.proxyBase || '').replace(/\/$/, '');
  if (base) return `${base}/v1beta/models/${model}:generateContent`;
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key || ''}`;
}

// Mały helper do logów w trybie dev
export const isDev = () =>
  ['localhost', '127.0.0.1'].includes(location.hostname);
