// =============================================================
//  AI — silnik rozmowy i analizy (abstrakcja providera)
// -------------------------------------------------------------
//  CONFIG.AI_PROVIDER:
//    'stub'   -> logika lokalna (działa offline, bez kluczy)
//    'gemini' -> realne Gemini API (gdy podamy klucz / proxy)
//  Interfejs publiczny jest WSPÓLNY — ekrany nie wiedzą, co siedzi pod spodem.
// =============================================================

import { CONFIG } from '../config.js';
import { IZABELA } from '../data/izabela.js';
import { store } from '../state.js';

// ---- Heurystyki stub: typowe błędy Polaków po angielsku ----
const STUB_RULES = [
  { re: /\bi am agree\b/i,        good: 'I agree',            note: '„Agree" to czasownik — nie mówimy „I am agree".', tag: 'grammar' },
  { re: /\bi have (\d+) years?\b/i, good: 'I am … years old',  note: 'Wiek po angielsku: „I am 20 years old", nie „I have".', tag: 'grammar' },
  { re: /\bmake (a )?photo\b/i,    good: 'take a photo',       note: 'Zdjęcie się „take", nie „make".', tag: 'vocab' },
  { re: /\bsince (\d+) years\b/i,  good: 'for … years',        note: 'Okres trwania: „for 3 years"; „since" + punkt w czasie.', tag: 'grammar' },
  { re: /\bhow it looks like\b/i,  good: 'what it looks like',  note: '„What does it look like?" — nie „how".', tag: 'grammar' },
  { re: /\binformations\b/i,       good: 'information',         note: '„Information" jest niepoliczalne — bez „s".', tag: 'grammar' },
  { re: /\byesterday i go\b/i,     good: 'yesterday I went',    note: '„Yesterday" → czas przeszły: „went".', tag: 'grammar' },
];

function stubAnalyze(text) {
  for (const r of STUB_RULES) {
    const m = text.match(r.re);
    if (m) return { bad: m[0], good: r.good, note: r.note, tag: r.tag };
  }
  return null;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Poziom ucznia → ile polskiego. Początkujący prowadzeni PO POLSKU.
const BEGINNER_LEVELS = ['A1', 'A2'];
export function currentLevel() { return store.get().onboarding.level || 'A2'; }
export function isBeginner() { return BEGINNER_LEVELS.includes(currentLevel()); }

const stubProvider = {
  async greet() { return { reply: pick(IZABELA.greetings), correction: null, mistake: null, lang: 'pl' }; },

  async chat({ text }) {
    const beg = isBeginner();
    const mistake = stubAnalyze(text);
    if (mistake) {
      return {
        reply: beg
          ? `${pick(['Ups, łap mnie!', 'Stop, stop 😄', 'O, mały haczyk!'])} Po angielsku mówimy „${mistake.good}". ${mistake.note} Spróbuj jeszcze raz, dasz radę!`
          : `${pick(['Oops, caught me!', 'Hold on 😄'])} Say "${mistake.good}" instead. ${mistake.note} Okay — go on!`,
        correction: { spoken: `Po angielsku: „${mistake.good}". ${mistake.note}` },
        mistake,
        lang: beg ? 'pl' : 'en',
      };
    }
    return {
      reply: beg
        ? `${pick(['Świetnie!', 'Brawo!', 'Idzie Ci super!'])} Powiedz mi coś więcej — spróbuj po angielsku, a jak zabraknie Ci słówka, spokojnie wtrąć po polsku, ja pomogę. 😊`
        : `${pick(IZABELA.encouragements)} And what happened next? Tell me more!`,
      correction: null, mistake: null,
      lang: beg ? 'pl' : 'en',
    };
  },

  // Głosowe Koło Ratunkowe — podpowiedź do zadania
  async hint({ task }) {
    return { reply: task?.hintSpoken || 'Spokojnie, pomyśl o czasie tej czynności i spróbuj jeszcze raz 😊' };
  },

  // Analiza nagrania słowa w Paszporcie Fonetycznym (stub: na bazie transkrypcji)
  async analyzeWord({ target, heard }) {
    // Tryb demo: łagodne dopasowanie (prawdziwy scoring fonemów dojdzie z Gemini/Whisper)
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');
    const h = norm(heard), t = norm(target.word);
    const ok = !!h && (h.includes(t.slice(0, 3)) || t.includes(h.slice(0, 3)) || h === t);
    return {
      ok,
      focus: target.focus,
      feedback: ok
        ? pick(['Świetnie!', 'O, ładnie!', 'Brzmi dobrze!'])
        : `Hmm, brzmiało jak „${heard || '...'}". Spróbuj: ${target.hint}`,
    };
  },

  // Budowa profilu fonetycznego z wyników słówek
  async buildProfile({ results }) {
    const challenges = [...new Set(results.filter((r) => !r.ok).map((r) => r.focus))];
    const strengths = [...new Set(results.filter((r) => r.ok).map((r) => r.focus))];
    return { strengths, challenges, samples: results, createdAt: Date.now() };
  },
};

// ---- Klucz Gemini: localStorage (na urządzeniu) lub CONFIG ----
const KEY_STORE = 'pogadajse.geminiKey';
function geminiKey() {
  try { return (localStorage.getItem(KEY_STORE) || CONFIG.GEMINI.apiKey || '').trim(); }
  catch { return (CONFIG.GEMINI.apiKey || '').trim(); }
}
export function setGeminiKey(key) {
  try { key ? localStorage.setItem(KEY_STORE, key.trim()) : localStorage.removeItem(KEY_STORE); } catch {}
}
export function hasGeminiKey() { return !!geminiKey(); }

// ---- Provider Gemini (aktywny gdy jest klucz) ----
const geminiProvider = {
  async _call(userText, { json = true } = {}) {
    const key = geminiKey();
    const { model, proxyUrl } = CONFIG.GEMINI;
    const url = proxyUrl
      || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const profile = store.get().phonetic.profile;
    const lvl = currentLevel();
    const beg = isBeginner();
    const langRule = beg
      ? 'Uczeń jest POCZĄTKUJĄCY — prowadź rozmowę GŁÓWNIE PO POLSKU, łagodnie zachęcając do prostych angielskich słów/zdań. Tłumacz wszystko po polsku.'
      : 'Prowadź rozmowę po angielsku na poziomie ucznia; korekty i wyjaśnienia po polsku.';
    const sys = `${IZABELA.systemPrompt}\n\nKONTEKST: Poziom CEFR: ${lvl}. ${langRule} Profil fonetyczny ucznia: ${JSON.stringify(profile)}.`;
    const body = {
      system_instruction: { parts: [{ text: sys }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: json ? { responseMimeType: 'application/json', temperature: 0.8 } : { temperature: 0.8 },
    };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Gemini API ' + res.status + ': ' + (await res.text()).slice(0, 200));
    const data = await res.json();
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return json ? JSON.parse(txt) : txt;
  },
  async greet() { return stubProvider.greet(); },
  async chat({ text }) {
    try {
      const r = await this._call(
        `Uczeń właśnie powiedział: "${text}". Odpowiedz krótko (2-3 zdania) i kontynuuj rozmowę. Zwróć JSON: {"reply": "...", "lang": "pl"|"en", "correction": {"spoken":"..."}|null, "mistake": {"bad":"...","good":"...","note":"...","tag":"grammar|vocab|pronunciation"}|null}.`
      );
      return { reply: r.reply, correction: r.correction || null, mistake: r.mistake || null, lang: r.lang || (isBeginner() ? 'pl' : 'en') };
    } catch (e) {
      console.warn('[Gemini chat]', e);
      return { reply: 'Ups, chwilowo nie mogę połączyć się z moim mózgiem AI 😅 Sprawdź klucz API i spróbuj ponownie.', correction: null, mistake: null, lang: 'pl' };
    }
  },
  async hint({ task, text }) {
    try {
      const r = await this._call(`Uczeń utknął w zadaniu: "${task?.prompt}". Mówi: "${text || 'podpowiedz'}". Naprowadź go PO POLSKU, nie podawaj gotowej odpowiedzi.`, { json: false });
      return { reply: r };
    } catch { return { reply: task?.hintSpoken || 'Spokojnie, pomyśl o czasie tej czynności 😊' }; }
  },
  async analyzeWord(args) { return stubProvider.analyzeWord(args); },     // wymowa lokalnie (na razie)
  async buildProfile(args) { return stubProvider.buildProfile(args); },
};

const useGemini = hasGeminiKey();
const provider = useGemini ? geminiProvider : stubProvider;

export const ai = {
  provider: useGemini ? 'gemini' : 'stub',
  greet: (...a) => provider.greet(...a),
  chat: (...a) => provider.chat(...a),
  hint: (...a) => provider.hint(...a),
  analyzeWord: (...a) => provider.analyzeWord(...a),
  buildProfile: (...a) => provider.buildProfile(...a),
};
