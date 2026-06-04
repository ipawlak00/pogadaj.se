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

const stubProvider = {
  async greet() { return { reply: pick(IZABELA.greetings), correction: null, mistake: null }; },

  async chat({ text }) {
    const mistake = stubAnalyze(text);
    if (mistake) {
      return {
        reply: `${pick(['Ups, łap mnie!', 'Stop, stop 😄', 'O, mały haczyk!'])} Powiedz raczej „${mistake.good}". ${mistake.note} Okej — go on, I'm listening!`,
        correction: { spoken: `Powiedz „${mistake.good}". ${mistake.note}` },
        mistake,
      };
    }
    return {
      reply: `${pick(IZABELA.encouragements)} And what happened next? Tell me more!`,
      correction: null, mistake: null,
    };
  },

  // Głosowe Koło Ratunkowe — podpowiedź do zadania
  async hint({ task }) {
    return { reply: task?.hintSpoken || 'Spokojnie, pomyśl o czasie tej czynności i spróbuj jeszcze raz 😊' };
  },

  // Analiza nagrania słowa w Paszporcie Fonetycznym (stub: na bazie transkrypcji)
  async analyzeWord({ target, heard }) {
    const ok = heard && heard.toLowerCase().replace(/[^a-z]/g, '')
                 .includes(target.word.toLowerCase().replace(/[^a-z]/g, '').slice(0, 4));
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

// ---- Provider Gemini (szkielet — aktywny gdy AI_PROVIDER='gemini') ----
const geminiProvider = {
  async _call(userParts, { json = true } = {}) {
    const { apiKey, model, proxyUrl } = CONFIG.GEMINI;
    const url = proxyUrl
      || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const profile = store.get().phonetic.profile;
    const lvl = store.get().onboarding.level || 'A2';
    const body = {
      system_instruction: { parts: [{ text:
        `${IZABELA.systemPrompt}\n\nKONTEKST: Poziom ucznia: ${lvl}. Profil fonetyczny: ${JSON.stringify(profile)}` }] },
      contents: [{ role: 'user', parts: [{ text: userParts }] }],
      generationConfig: json ? { responseMimeType: 'application/json' } : {},
    };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Gemini API: ' + res.status);
    const data = await res.json();
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return json ? JSON.parse(txt) : txt;
  },
  async greet() { return stubProvider.greet(); },
  async chat({ text }) { return this._call(`Uczeń powiedział: "${text}"`); },
  async hint({ task, text }) {
    const r = await this._call(`Uczeń utknął w zadaniu: "${task?.prompt}". Pyta: "${text || 'podpowiedz'}". Naprowadź go, nie podawaj gotowej odpowiedzi.`, { json: false });
    return { reply: r };
  },
  async analyzeWord(args) { return stubProvider.analyzeWord(args); },     // wymowa lokalnie
  async buildProfile(args) { return stubProvider.buildProfile(args); },
};

const provider = CONFIG.AI_PROVIDER === 'gemini' ? geminiProvider : stubProvider;

export const ai = {
  provider: CONFIG.AI_PROVIDER,
  greet: (...a) => provider.greet(...a),
  chat: (...a) => provider.chat(...a),
  hint: (...a) => provider.hint(...a),
  analyzeWord: (...a) => provider.analyzeWord(...a),
  buildProfile: (...a) => provider.buildProfile(...a),
};
