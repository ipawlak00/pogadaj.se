// =============================================================
//  AI — silnik rozmowy i analizy (abstrakcja providera)
// -------------------------------------------------------------
//  CONFIG.AI_PROVIDER:
//    'stub'   -> logika lokalna (działa offline, bez kluczy)
//    'gemini' -> realne Gemini API (gdy podamy klucz / proxy)
//  Interfejs publiczny jest WSPÓLNY — ekrany nie wiedzą, co siedzi pod spodem.
// =============================================================

import { CONFIG, genContentUrl, geminiConfigured } from '../config.js';
import { IZABELA } from '../data/izabela.js';
import { store } from '../state.js';
import { toast } from '../ui.js';
import { FULL_MONTH_MINUTES } from '../data/lessons.js';

// Loguj błąd AI do konsoli (diagnostyka dla dewelopera). Techniczny toast
// pokazujemy WYŁĄCZNIE w trybie deweloperskim z własnym kluczem — użytkownik
// na produkcji (proxy) NIGDY nie widzi komunikatów o kluczu/AI.
let aiErrorShown = false;
function reportAiError(e) {
  console.warn('[Gemini]', e);
  if (geminiConfigured()) return;            // produkcja (proxy) → cicho, tylko konsola
  if (aiErrorShown) return;
  aiErrorShown = true;
  toast('Gemini (dev): ' + String(e && (e.message || e)), 'error');
}

// Wypowiedź „w charakterze", gdy AI chwilowo nie odpowie — NIGDY techniczna,
// nigdy o kluczu/AI. Izabela po prostu prosi o powtórzenie i płynie dalej.
function graceLine() {
  return pick([
    'Ojej, zgubiłam na chwilę wątek. Rzuć jeszcze raz to ostatnie zdanie, dobra?',
    'Chwila, chwila, coś mi umknęło. Powiedz to jeszcze raz, złapię się.',
    'Uuu, odpłynęłam na moment. Powtórz proszę, już jestem z Tobą.',
    'Sekundka, pogubiłam się odrobinę. Powiedz to jeszcze raz, a lecimy dalej.',
  ]);
}

// Kim jest uczeń — imię i (heurystycznie z imienia) płeć.
// Dzięki temu Izabela mówi po imieniu i NIE pisze form „zrobiłeś/aś".
function userLine() {
  const name = (store.get().user?.name || '').trim();
  if (!name || /^gość$/i.test(name)) {
    return 'Imienia ucznia jeszcze nie znasz — pisz neutralnie i NIGDY nie używaj form z ukośnikiem typu „zrobiłeś/aś".';
  }
  const maleException = /^(kuba|barnaba|kosma|bonawentura|dyzma|saba)$/i.test(name);
  const female = !maleException && /a$/i.test(name);
  return `Uczeń ma na imię ${name} (najpewniej ${female ? 'kobieta' : 'mężczyzna'}). Zwracaj się do ucznia po imieniu, buduj relację i używaj końcówek rodzaju ${female ? 'żeńskiego' : 'męskiego'} — NIGDY form z ukośnikiem („zrobiłeś/aś", „gotowy/a").`;
}

// PRAWDZIWE dane o uczniu i jego aktywności — Izabela ma być SPOSTRZEGAWCZA
// i komentować to naturalnie (mało lekcji, mało czasu, wiek itd.).
function userContext() {
  const s = store.get();
  const age = parseInt(s.onboarding.age, 10) || null;
  const hist = s.progress.history || [];
  const totalMin = Math.round(hist.reduce((a, h) => a + (h.seconds || 0), 0) / 60);
  const usedSec = s.progress.fullSecondsUsed || 0;
  const leftMin = Math.max(0, Math.round((FULL_MONTH_MINUTES * 60 - usedSec) / 60));
  const ageNote = !age ? '' : age < 13
    ? `Wiek: ${age} lat — to DZIECKO. Mów prościej i cieplej, żarty tylko niewinne i grzeczne, ZERO wulgaryzmów i treści dla dorosłych.`
    : age < 18
    ? `Wiek: ${age} lat — nastolatek. Luźno, na luzie, ale bez wulgaryzmów.`
    : `Wiek: ${age} lat — dorosły. Możesz żartować śmielej.`;
  const activity = hist.length <= 1 && totalMin <= 1
    ? `Uczeń ma dopiero ${hist.length} lekcję i tylko ~${totalMin} min rozmów — możesz się z tego pośmiać (brechta!), że na razie cieniutko, ale zachęcająco, bez dołowania.`
    : `Odbytych lekcji: ${hist.length}, łącznie ~${totalMin} min rozmów.`;
  return `DANE O UCZNIU (analizuj je i komentuj naturalnie, gdy się nadarzy): ${ageNote} ${activity} Zostało ~${leftMin} min czasu w tym miesiącu. Bądź spostrzegawcza — jeśli coś w tych danych aż prosi się o żarcik, rzuć go.`;
}

// Wywołanie Gemini z ponawianiem przy przejściowych błędach (429/503 — limit na minutę).
async function geminiFetch(url, body) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, attempt * 2500));   // 0s, 2.5s, 5s
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) return res.json();
    lastErr = new Error('Gemini API ' + res.status + ': ' + (await res.text()).slice(0, 200));
    if (res.status !== 429 && res.status !== 503) break;   // ponawiamy tylko przejściowe
  }
  throw lastErr;
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

// Suchary awaryjne (gdy AI niedostępne) — klasyczne, z sensowną puentą,
// grzeczne i bezpieczne też dla dzieci.
const JOKES = [
  'Jak nazywa się pies bez nóg? Nieważne jak go zawołasz i tak nie przybiegnie.',
  'Dlaczego szkielet nie poszedł na bal? Bo nie miał z kim, no i nie miał do tego serca.',
  'Idzie sobie zero, widzi ósemkę i mówi: ej, fajny pasek!',
  'Przychodzi baba do lekarza, a lekarza nie ma. No to baba sobie poszła.',
  'Dlaczego komputer był zmęczony? Bo miał pełny dysk.',
  'Dlaczego ryby żyją w wodzie? Bo koty nie umieją pływać.',
  'Co robi krowa na trampolinie? Mleko w proszku.',
  'Czemu żółw nie ma konta na Instagramie? Bo za wolno ładuje zdjęcia.',
  'Jak matematyk wychodzi z lasu? Po pierwiastku.',
  'Dlaczego pomidor się zaczerwienił? Bo zobaczył sałatę bez ubrania.',
];

// Kompaktowy profil fonetyczny do promptów — bez surowych sampli,
// za to z konkretnymi problemami, które Izabela ma pamiętać i łapać.
function profileForPrompt() {
  const p = store.get().phonetic.profile;
  if (!p) return 'brak (test fonetyczny jeszcze przed nami)';
  const issues = (p.issues || []).map((i) => `${i.word}${i.issue ? ': ' + i.issue : ''}`).filter(Boolean);
  return JSON.stringify({
    challenges: p.challenges || [], strengths: p.strengths || [], problemy: issues,
    trudnosciZgloszonePrzezUcznia: p.selfReported || '',
  });
}

// Poziom ucznia → ile polskiego. Początkujący prowadzeni PO POLSKU.
const BEGINNER_LEVELS = ['A1', 'A2'];
const ADVANCED_LEVELS = ['C1', 'C2'];
export function currentLevel() { return store.get().onboarding.level || 'A2'; }
export function isBeginner() { return BEGINNER_LEVELS.includes(currentLevel()); }
// Zaawansowani (C1/C2) dostają PIERWSZĄ kwestię od razu po angielsku; reszta po polsku.
export function isAdvanced() { return ADVANCED_LEVELS.includes(currentLevel()); }

// System prompt dla TRYBU LEKCJI prowadzonej przez AI (adaptacyjnie, ~45 min)
function lessonSystem() {
  const lvl = currentLevel();
  const beg = isBeginner();
  const adv = isAdvanced();
  const oriented = !!store.get().progress.oriented;   // czy uczeń zna już zasady
  return `${IZABELA.systemPrompt}

TRYB LEKCJI — prowadzisz interaktywną, DŁUGĄ lekcję mówienia (cel ~45 minut):
- ${userLine()}
- ${userContext()}
- Poziom ucznia: ${lvl}. ${beg ? 'POCZĄTKUJĄCY — prowadź po polsku, ucz bardzo prostych, krótkich angielskich fraz.' : 'Prowadź po angielsku, dobieraj trudność do ucznia.'}
- JĘZYK PIERWSZEJ WYPOWIEDZI: ${adv ? 'uczeń jest zaawansowany (C1/C2) — pierwszą wypowiedź (powitanie i wprowadzenie) powiedz PO ANGIELSKU, ustaw "lang":"en".' : 'pierwszą wypowiedź lekcji (powitanie oraz wyjaśnienie zasad) powiedz PO POLSKU i ustaw "lang":"pl", żeby uczeń na pewno wszystko zrozumiał. Dopiero KOLEJNE wypowiedzi prowadź w języku wg poziomu.'}
- ${oriented
    ? 'Uczeń ZNA JUŻ zasady (że może mieszać polski z angielskim i że rozmawiacie o tym, co chce). NIE POWTARZAJ tych zasad ani żadnego wstępnego regulaminu — po prostu wejdź od razu w rozmowę/naukę.'
    : `Tylko RAZ, w pierwszej wypowiedzi${adv ? '' : ' (PO POLSKU)'}, powiedz krótko dwie rzeczy: 1) uczeń może mówić po polsku i angielsku, może je mieszać, a jak zabraknie słówka, dopowie po polsku i pomożesz; 2) rozmawiacie o czym CHCE uczeń, jak Twój temat go nie interesuje, niech śmiało rzuci swój. Powiedz to raz i nigdy do tego nie wracaj.`}
- Uczeń może w KAŻDEJ chwili zmienić temat rozmowy. Gdy to robi, podchwytuj bez marudzenia i ucz dalej na jego temacie.
- Ucz krok po kroku: NAJPIERW powiedz frazę po angielsku (w cudzysłowie „..."), POTEM jej znaczenie po polsku, POTEM poproś, żeby uczeń ją POWTÓRZYŁ na głos.
- Wypowiedź ucznia pochodzi z rozpoznawania mowy i bywa niedokładna — bądź wyrozumiała, nie czepiaj się drobiazgów.
- Gdy powtórzy dobrze: krótko pochwal i wprowadź kolejną frazę albo proste pytanie. Gdy nie wychodzi: rozbij frazę na krótsze KAWAŁKI i ćwicz fragment po fragmencie, mów wolniej.
- Stopniowo zwiększaj trudność, zmieniaj podtematy, wplataj krótkie pytania do ucznia. Lekcja ma być długa i angażująca — NIE kończ jej szybko.
- WAŻNE: uczeń może mówić do Ciebie PO POLSKU lub PO ANGIELSKU i w każdej chwili zadać własne pytanie albo Ci przerwać. Gdy zadaje pytanie (np. „jak powiedzieć…?", „co znaczy…?", „dlaczego…?") — najpierw naturalnie i krótko ODPOWIEDZ na to pytanie, a dopiero potem płynnie wróć do nauki. Nigdy nie ignoruj pytania ucznia.
- Jedna wypowiedź = 2-4 pełne zdania. Mów jak człowiek, płynnie i z życiem — nie rzucaj samych haseł ani skrótów myślowych.
- "suggestions" to 2-4 krótkie angielskie frazy, które uczeń może teraz powiedzieć.
- "repeat": ustaw na KONKRETNĄ angielską frazę TYLKO wtedy, gdy w tej wypowiedzi wprost prosisz ucznia, by ją POWTÓRZYŁ na głos (np. „powtórz za mną", „spróbuj to wymówić"). W swobodnej rozmowie, gdy zadajesz pytanie i czekasz na odpowiedź, ustaw "repeat":null. To pole steruje podpowiedzią „Powtórz:" na ekranie — ma się pojawiać wyłącznie przy prośbie o powtórzenie.
Zwracaj WYŁĄCZNIE JSON:
{"say":"...", "lang":"pl"|"en", "suggestions":["..."], "repeat":"fraza do powtórzenia"|null, "correction":{"spoken":"..."}|null, "mistake":{"bad":"...","good":"...","note":"...","tag":"grammar|vocab|pronunciation"}|null, "done":false}
Ustaw "done":true dopiero, gdy lekcja naprawdę dobiega końca (po wielu ćwiczeniach).
Profil fonetyczny ucznia (PAMIĘTAJ o tych problemach i łap je podczas rozmowy): ${profileForPrompt()}.`;
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

  async tellJoke() { return pick(JOKES); },

  // Lekcja AI niedostępna bez Gemini — sygnał do fallbacku na proste kroki
  async lessonReply() { return { say: '', lang: 'pl', suggestions: [], done: true, unsupported: true }; },
  async reactToName() { return null; },
  async summarizeLesson() { return null; },
  async transcribe() { return null; },     // brak Gemini → użyjemy rozpoznawania przeglądarki

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
  // Konkretne problemy z wymową (słowo + co było nie tak) — Izabela ma je PAMIĘTAĆ
  const issues = results
    .filter((r) => r && !r.ok && !r.skipped && (r.issue || r.tip))
    .map((r) => ({ word: r.word || '', focus: r.focus || '', issue: r.issue || '', tip: r.tip || '', heard: r.heard || '' }));
  return { strengths, challenges, focusScores, overall, issues, samples: results, createdAt: Date.now() };
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
// Gemini jest dostępne gdy: jest proxy (dla wszystkich), klucz w CONFIG, albo klucz użytkownika
export function hasGeminiKey() { return geminiConfigured() || !!geminiKey(); }

// ---- Provider Gemini (aktywny gdy jest klucz) ----
const geminiProvider = {
  async _call(userText, { json = true } = {}) {
    const url = CONFIG.GEMINI.proxyUrl || genContentUrl(CONFIG.GEMINI.model, geminiKey());
    const lvl = currentLevel();
    const beg = isBeginner();
    const langRule = beg
      ? 'Uczeń jest POCZĄTKUJĄCY — prowadź rozmowę GŁÓWNIE PO POLSKU, łagodnie zachęcając do prostych angielskich słów/zdań. Tłumacz wszystko po polsku.'
      : 'Prowadź rozmowę po angielsku na poziomie ucznia; korekty i wyjaśnienia po polsku.';
    const sys = `${IZABELA.systemPrompt}\n\nKONTEKST: Poziom CEFR: ${lvl}. ${langRule} ${userLine()} ${userContext()} Profil fonetyczny ucznia: ${profileForPrompt()}.`;
    const body = {
      system_instruction: { parts: [{ text: sys }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: json ? { responseMimeType: 'application/json', temperature: 0.8 } : { temperature: 0.8 },
    };
    const data = await geminiFetch(url, body);
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
      return { reply: graceLine(), correction: null, mistake: null, lang: 'pl', suggestions: [] };
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
      const r = await this._callContents(contents, sys, CONFIG.GEMINI.fastModel);   // szybki model — mniejsze opóźnienie
      return {
        ok: !!r.ok, score: typeof r.score === 'number' ? Math.max(0, Math.min(100, r.score)) : null,
        heard: r.heard || '', issue: r.issue || null, tip: r.tip || '', praise: r.praise || null,
        focus: target.focus,
      };
    } catch (e) { reportAiError(e); return null; }
  },

  // Wielo-turowe wywołanie (lekcja prowadzona przez AI)
  async _callContents(contents, systemText, model) {
    const url = CONFIG.GEMINI.proxyUrl || genContentUrl(model || CONFIG.GEMINI.model, geminiKey());
    const body = {
      system_instruction: { parts: [{ text: systemText }] },
      contents,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.85 },
    };
    const data = await geminiFetch(url, body);
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
  },
  async lessonReply(history) {
    try {
      const contents = history.map((h) => ({ role: h.role, parts: [{ text: h.text }] }));
      const r = await this._callContents(contents, lessonSystem());
      return {
        say: r.say || r.reply || '', lang: r.lang || (isBeginner() ? 'pl' : 'en'),
        suggestions: Array.isArray(r.suggestions) ? r.suggestions.slice(0, 4) : [],
        repeat: typeof r.repeat === 'string' && r.repeat.trim() ? r.repeat.trim() : null,
        correction: r.correction || null, mistake: r.mistake || null, done: !!r.done,
      };
    } catch (e) {
      reportAiError(e);
      return { say: graceLine(), lang: 'pl', suggestions: [], done: false };
    }
  },

  // Żywa, personalna reakcja Izabeli na imię ucznia (krótkie zdanie)
  async reactToName(name) {
    try {
      const sys = IZABELA.systemPrompt;
      const contents = [{ role: 'user', parts: [{ text: `Uczeń właśnie przedstawił się imieniem "${name}". Zareaguj JEDNYM krótkim zdaniem po polsku (max 14 słów), luźno i po swojemu, nawiąż jakoś do tego konkretnego imienia. Jeśli imię jest takie samo jak Twoje (Izabela), autentycznie i entuzjastycznie się podjaraj. NIE zdrabniaj imienia. Zwróć JSON: {"say":"..."}` }] }];
      const r = await this._callContents(contents, sys, CONFIG.GEMINI.fastModel);
      return (r.say || '').trim() || null;
    } catch (e) { return null; }
  },

  // Suchar na życzenie — w stylu Izabeli, dopasowany do wieku (dziecko → niewinny)
  async tellJoke() {
    try {
      const contents = [{ role: 'user', parts: [{ text: `Opowiedz JEDEN klasyczny żart-suchar po polsku (typu pytanie–odpowiedź albo „przychodzi baba do lekarza"). MUSI mieć SENS i wyraźną, zrozumiałą puentę — nie wymyślaj bełkotu ani gry słów, która nie działa. Ma być głupkowaty, ale logiczny (jak: „Jak nazywa się pies bez nóg? Nieważne jak go zawołasz i tak nie przybiegnie."). ${userContext()} DOPASUJ do wieku: dla dziecka tylko niewinny i grzeczny. Max 2-3 krótkie zdania (będzie czytane na głos). Zwróć JSON: {"joke":"..."}` }] }];
      const r = await this._callContents(contents, IZABELA.systemPrompt, CONFIG.GEMINI.fastModel);
      return (r.joke || '').trim() || pick(JOKES);
    } catch (e) { return pick(JOKES); }
  },

  // Krótkie, OSOBISTE wspomnienie lekcji (do historii) — oczami Izabeli,
  // zwrócone do ucznia na „Ty", a nie sztywne „uczeń rozmawiał z Izabelą".
  async summarizeLesson(chatText) {
    try {
      const sys = 'Zapisujesz krótką, KONKRETNĄ notatkę o treści lekcji angielskiego. Zwracasz wyłącznie JSON.';
      const contents = [{ role: 'user', parts: [{ text: `Napisz PO POLSKU krótko (1-2 zdania) SAME FAKTY: o czym była rozmowa i czego uczeń się uczył (temat, ćwiczone zwroty/słówka, gramatyka). Zwracaj się na „Ty" (np. „Rozmawialiśmy o planach na weekend; ćwiczyłaś zwroty do zamawiania jedzenia i czas Present Continuous."). NIE opisuj emocji ani nastroju Izabeli (żadnego „Izabela była podekscytowana"), nie pisz ozdobników — tylko konkret. ${userLine()}
Rozmowa:
${String(chatText).slice(0, 4000)}
Zwróć JSON: {"summary":"..."}` }] }];
      const r = await this._callContents(contents, sys, CONFIG.GEMINI.fastModel);
      return (r.summary || '').trim() || null;
    } catch (e) { return null; }
  },

  // Transkrypcja mowy ucznia — Gemini słucha nagrania i wyłapuje MIKS PL+EN
  async transcribe({ base64, mimeType }) {
    try {
      const sys = 'Jesteś precyzyjnym systemem transkrypcji mowy. Zwracasz wyłącznie poprawny JSON, bez markdown.';
      const prompt = `Przepisz DOKŁADNIE, co osoba powiedziała na nagraniu. Osoba uczy się angielskiego i MOŻE MIESZAĆ polski z angielskim w jednym zdaniu — zapisz każde słowo w języku, w jakim je wypowiedziano (angielskie słowa po angielsku, polskie po polsku). Nie tłumacz, nie poprawiaj gramatyki, nie dodawaj nic od siebie. BEZ znaczników czasu (żadnych 00:01), bez numeracji, bez didaskaliów. Jeśli nic nie słychać, zwróć pusty tekst.
Zwróć JSON: {"text": "dokładna transkrypcja"}`;
      const contents = [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mimeType || 'audio/webm', data: base64 } }] }];
      const r = await this._callContents(contents, sys, CONFIG.GEMINI.fastModel);   // szybki model — mniejsze opóźnienie
      // pas bezpieczeństwa: wytnij znaczniki czasu, gdyby model je dodał
      return (r.text || '').replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ').replace(/\s{2,}/g, ' ').trim();
    } catch (e) { reportAiError(e); return null; }
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
  transcribe: (...a) => provider.transcribe(...a),
  reactToName: (...a) => provider.reactToName(...a),
  summarizeLesson: (...a) => provider.summarizeLesson(...a),
  tellJoke: (...a) => provider.tellJoke(...a),
};
