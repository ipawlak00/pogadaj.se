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
import { toast } from '../ui.js';

// Pokaż PRAWDZIWY błąd połączenia z Gemini (raz), żeby dało się go zdiagnozować.
let aiErrorShown = false;
function reportAiError(e) {
  console.warn('[Gemini]', e);
  if (aiErrorShown) return;
  aiErrorShown = true;
  const msg = String(e && (e.message || e));
  let hint = '';
  if (/\b403\b|PERMISSION|API_KEY|referer|referrer|blocked/i.test(msg)) hint = ' — klucz nieprawidłowy lub ma ograniczenia (HTTP referrer / API niewłączone).';
  else if (/\b429\b|quota|RESOURCE_EXHAUSTED/i.test(msg)) hint = ' — przekroczony limit (quota). Odczekaj lub włącz rozliczenia.';
  else if (/\b404\b|not found|NOT_FOUND/i.test(msg)) hint = ' — model niedostępny na tym kluczu.';
  else if (/\b400\b/i.test(msg)) hint = ' — błędne zapytanie/klucz.';
  toast('Gemini: ' + msg + hint, 'error');
}

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

// System prompt dla TRYBU LEKCJI prowadzonej przez AI (adaptacyjnie, ~45 min)
function lessonSystem() {
  const lvl = currentLevel();
  const beg = isBeginner();
  const profile = store.get().phonetic.profile;
  return `${IZABELA.systemPrompt}

TRYB LEKCJI — prowadzisz interaktywną, DŁUGĄ lekcję mówienia (cel ~45 minut):
- Poziom ucznia: ${lvl}. ${beg ? 'POCZĄTKUJĄCY — prowadź po polsku, ucz bardzo prostych, krótkich angielskich fraz.' : 'Prowadź po angielsku, dobieraj trudność do ucznia.'}
- Ucz krok po kroku: NAJPIERW powiedz frazę po angielsku (w cudzysłowie „..."), POTEM jej znaczenie po polsku, POTEM poproś, żeby uczeń ją POWTÓRZYŁ na głos.
- Wypowiedź ucznia pochodzi z rozpoznawania mowy i bywa niedokładna — bądź wyrozumiała, nie czepiaj się drobiazgów.
- Gdy powtórzy dobrze: krótko pochwal i wprowadź kolejną frazę albo proste pytanie. Gdy nie wychodzi: rozbij frazę na krótsze KAWAŁKI i ćwicz fragment po fragmencie, mów wolniej.
- Stopniowo zwiększaj trudność, zmieniaj podtematy, wplataj krótkie pytania do ucznia. Lekcja ma być długa i angażująca — NIE kończ jej szybko.
- WAŻNE: uczeń może mówić do Ciebie PO POLSKU lub PO ANGIELSKU i w każdej chwili zadać własne pytanie albo Ci przerwać. Gdy zadaje pytanie (np. „jak powiedzieć…?", „co znaczy…?", „dlaczego…?") — najpierw naturalnie i krótko ODPOWIEDZ na to pytanie, a dopiero potem płynnie wróć do nauki. Nigdy nie ignoruj pytania ucznia.
- Jedna wypowiedź = 1-3 krótkie zdania.
- "suggestions" to 2-4 krótkie angielskie frazy, które uczeń może teraz powiedzieć.
Zwracaj WYŁĄCZNIE JSON:
{"say":"...", "lang":"pl"|"en", "suggestions":["..."], "correction":{"spoken":"..."}|null, "mistake":{"bad":"...","good":"...","note":"...","tag":"grammar|vocab|pronunciation"}|null, "done":false}
Ustaw "done":true dopiero, gdy lekcja naprawdę dobiega końca (po wielu ćwiczeniach).
Profil fonetyczny ucznia: ${JSON.stringify(profile)}.`;
}

const stubProvider = {
  async greet() { return { reply: pick(IZABELA.greetings), correction: null, mistake: null, lang: 'pl' }; },

  async chat({ text }) {
    const beg = isBeginner();
    const mistake = stubAnalyze(text);
    if (mistake) {
      return {
        reply: beg
          ? `${pick(['Ups, łap mnie!', 'Stop, stop', 'O, mały haczyk!'])} Po angielsku mówimy „${mistake.good}". ${mistake.note} Spróbuj jeszcze raz, dasz radę!`
          : `${pick(['Oops, caught me!', 'Hold on'])} Say "${mistake.good}" instead. ${mistake.note} Okay — go on!`,
        correction: { spoken: `Po angielsku: „${mistake.good}". ${mistake.note}` },
        mistake,
        lang: beg ? 'pl' : 'en',
        suggestions: [mistake.good, 'I think...', 'Because...'],
      };
    }
    return {
      reply: beg
        ? `${pick(['Świetnie!', 'Brawo!', 'Idzie Ci super!'])} Powiedz mi coś więcej — spróbuj po angielsku, a jak zabraknie Ci słówka, spokojnie wtrąć po polsku, ja pomogę.`
        : `${pick(IZABELA.encouragements)} And what happened next? Tell me more!`,
      correction: null, mistake: null,
      lang: beg ? 'pl' : 'en',
      suggestions: pick([['I like...', 'I want to...', 'My favourite...'], ['Yesterday I...', 'I usually...', 'In my free time...']]),
    };
  },

  // Głosowe Koło Ratunkowe — podpowiedź do zadania
  async hint({ task }) {
    return { reply: task?.hintSpoken || 'Spokojnie, pomyśl o czasie tej czynności i spróbuj jeszcze raz' };
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

  // Lekcja AI niedostępna bez Gemini — sygnał do fallbacku na proste kroki
  async lessonReply() { return { say: '', lang: 'pl', suggestions: [], done: true, unsupported: true }; },

  // Analiza wymowy niedostępna bez Gemini → sygnał do fallbacku (Web Speech)
  async analyzePronunciation() { return null; },

  // Budowa profilu fonetycznego z wyników słówek
  async buildProfile({ results }) {
    return buildProfileFrom(results);
  },
};

// Wspólna agregacja profilu fonetycznego (uwzględnia wynik 0-100 jeśli jest)
function buildProfileFrom(results) {
  const byFocus = {};
  for (const r of results) {
    if (!r || !r.focus) continue;
    (byFocus[r.focus] ||= []).push(typeof r.score === 'number' ? r.score : (r.ok ? 85 : 45));
  }
  const avg = (a) => Math.round(a.reduce((s, x) => s + x, 0) / a.length);
  const focusScores = Object.fromEntries(Object.entries(byFocus).map(([k, v]) => [k, avg(v)]));
  const challenges = Object.entries(focusScores).filter(([, s]) => s < 70).sort((a, b) => a[1] - b[1]).map(([k]) => k);
  const strengths = Object.entries(focusScores).filter(([, s]) => s >= 85).map(([k]) => k);
  const all = results.map((r) => (typeof r.score === 'number' ? r.score : (r.ok ? 85 : 45))).filter((x) => x != null);
  const overall = all.length ? avg(all) : null;
  return { strengths, challenges, focusScores, overall, samples: results, createdAt: Date.now() };
}

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
        `Uczeń właśnie powiedział (z mikrofonu): "${text}". Odpowiedz krótko (2-3 zdania), angielskie przykłady w cudzysłowie. Pamiętaj: uczeń tylko mówi, nie pisze. Zwróć pełny JSON wg formatu (z polami lang i suggestions).`
      );
      return {
        reply: r.reply, correction: r.correction || null, mistake: r.mistake || null,
        lang: r.lang || (isBeginner() ? 'pl' : 'en'),
        suggestions: Array.isArray(r.suggestions) ? r.suggestions.slice(0, 4) : [],
      };
    } catch (e) {
      reportAiError(e);
      return { reply: 'Ups, chwilowo nie mogę połączyć się z moim mózgiem AI. Sprawdź klucz API i spróbuj ponownie.', correction: null, mistake: null, lang: 'pl', suggestions: [] };
    }
  },
  async hint({ task, text }) {
    try {
      const r = await this._call(`Uczeń utknął w zadaniu: "${task?.prompt}". Mówi: "${text || 'podpowiedz'}". Naprowadź go PO POLSKU, nie podawaj gotowej odpowiedzi.`, { json: false });
      return { reply: r };
    } catch { return { reply: task?.hintSpoken || 'Spokojnie, pomyśl o czasie tej czynności' }; }
  },
  async analyzeWord(args) { return stubProvider.analyzeWord(args); },     // fallback tekstowy
  async buildProfile({ results }) { return buildProfileFrom(results); },

  // PRAWDZIWA analiza wymowy: Gemini SŁUCHA nagrania ucznia
  async analyzePronunciation({ target, base64, mimeType }) {
    try {
      const sys = 'Jesteś Izabelą — ciepłą, konkretną nauczycielką wymowy angielskiego dla Polaków. Słuchasz nagrania i oceniasz wymowę POJEDYNCZEGO słowa. Odpowiadasz wyłącznie poprawnym JSON, bez markdown.';
      const prompt = `Uczeń (Polak) miał wymówić angielskie słowo "${target.word}" (IPA: ${target.ipa}; kluczowy dźwięk: ${target.focus}). Posłuchaj nagrania i oceń wymowę uczciwie, ale życzliwie.
Zwróć JSON:
{
 "heard": "co najprawdopodobniej słyszysz (krótko)",
 "score": liczba 0-100 (jak blisko poprawnej wymowy),
 "ok": true/false (true gdy score>=70),
 "issue": "krótka etykieta głównego błędu lub null, np. 'TH wymówione jak F'",
 "tip": "jedno-dwa zdania PO POLSKU: konkretnie jak poprawić ten dźwięk (ułożenie języka/ust)",
 "praise": "krótka pochwała po polsku gdy dobrze, inaczej null"
}`;
      const contents = [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mimeType || 'audio/webm', data: base64 } }] }];
      const r = await this._callContents(contents, sys);
      return {
        ok: !!r.ok, score: typeof r.score === 'number' ? Math.max(0, Math.min(100, r.score)) : null,
        heard: r.heard || '', issue: r.issue || null, tip: r.tip || '', praise: r.praise || null,
        focus: target.focus,
      };
    } catch (e) { reportAiError(e); return null; }
  },

  // Wielo-turowe wywołanie (lekcja prowadzona przez AI)
  async _callContents(contents, systemText) {
    const key = geminiKey();
    const { model, proxyUrl } = CONFIG.GEMINI;
    const url = proxyUrl || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const body = {
      system_instruction: { parts: [{ text: systemText }] },
      contents,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.85 },
    };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Gemini API ' + res.status + ': ' + (await res.text()).slice(0, 200));
    const data = await res.json();
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
  },
  async lessonReply(history) {
    try {
      const contents = history.map((h) => ({ role: h.role, parts: [{ text: h.text }] }));
      const r = await this._callContents(contents, lessonSystem());
      return {
        say: r.say || r.reply || '', lang: r.lang || (isBeginner() ? 'pl' : 'en'),
        suggestions: Array.isArray(r.suggestions) ? r.suggestions.slice(0, 4) : [],
        correction: r.correction || null, mistake: r.mistake || null, done: !!r.done,
      };
    } catch (e) {
      reportAiError(e);
      return { say: 'Ups, chwilowo nie mogę połączyć się z AI. Sprawdź klucz i spróbuj jeszcze raz.', lang: 'pl', suggestions: [], done: false };
    }
  },
};

const useGemini = hasGeminiKey();
const provider = useGemini ? geminiProvider : stubProvider;

export const ai = {
  provider: useGemini ? 'gemini' : 'stub',
  greet: (...a) => provider.greet(...a),
  chat: (...a) => provider.chat(...a),
  hint: (...a) => provider.hint(...a),
  analyzeWord: (...a) => provider.analyzeWord(...a),
  analyzePronunciation: (...a) => provider.analyzePronunciation(...a),
  buildProfile: (...a) => provider.buildProfile(...a),
  lessonReply: (...a) => provider.lessonReply(...a),
};
