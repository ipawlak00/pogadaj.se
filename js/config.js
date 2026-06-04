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
    apiKey: '',                 // NIE commitujemy klucza do repo!
    model: 'gemini-2.5-flash',
    // Zalecane: trzymać klucz po stronie Firebase Functions (proxy),
    // a tu zostawić proxyUrl zamiast apiKey.
    proxyUrl: '',
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

// Mały helper do logów w trybie dev
export const isDev = () =>
  ['localhost', '127.0.0.1'].includes(location.hostname);
