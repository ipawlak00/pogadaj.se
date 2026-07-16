// =============================================================
//  Speech — warstwa mowy (STT + TTS)
// -------------------------------------------------------------
//  STT: Web Speech API.
//  TTS: jeśli skonfigurowano ElevenLabs (klucz + Voice ID) → mówi
//       sklonowanym głosem (PL+EN). Inaczej → wbudowany głos przeglądarki.
// =============================================================

import { CONFIG, genContentUrl, geminiConfigured } from '../config.js';
import { toast } from '../ui.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

// ---- ElevenLabs: dane logowania (tylko na urządzeniu) ----
const EL_KEY = 'pogadajse.elevenKey';
const EL_VOICE = 'pogadajse.elevenVoice';
const ls = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
export function setElevenCreds(key, voice) {
  try {
    key ? localStorage.setItem(EL_KEY, key.trim()) : localStorage.removeItem(EL_KEY);
    voice ? localStorage.setItem(EL_VOICE, voice.trim()) : localStorage.removeItem(EL_VOICE);
  } catch {}
}
export function hasEleven() { return !!(ls(EL_KEY) && ls(EL_VOICE)); }

// ---- Google Cloud Text-to-Speech — GŁÓWNY głos Izabeli (skalowalny) ----
// Przez proxy (bez klucza) gdy proxyBase ustawione; lokalny klucz to zapas dev.
const GTTS_KEY = 'pogadajse.gttsKey';
export function setGoogleTTSKey(key) {
  try { key ? localStorage.setItem(GTTS_KEY, key.trim()) : localStorage.removeItem(GTTS_KEY); } catch {}
}
export function hasGoogleTTS() { return geminiConfigured() || !!ls(GTTS_KEY); }
function gttsSynthUrl() {
  const base = (CONFIG.GEMINI.proxyBase || '').replace(/\/$/, '');
  if (base) return `${base}/v1/text:synthesize`;
  return `https://texttospeech.googleapis.com/v1/text:synthesize?key=${ls(GTTS_KEY)}`;
}

// Głosy Izabeli wg języka — od najbardziej naturalnego do zapasowego.
// Pierwszy, który zadziała na danym kluczu/projekcie, zostaje zapamiętany.
const GTTS_VOICES = {
  pl: [
    { languageCode: 'pl-PL', name: 'pl-PL-Chirp3-HD-Despina' },        // wybrany przez Izabelę (odsłuch)
    { languageCode: 'pl-PL', name: 'pl-PL-Chirp3-HD-Leda' },
    { languageCode: 'pl-PL', name: 'pl-PL-Wavenet-A', ssmlGender: 'FEMALE' },
  ],
  en: [
    { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Despina' },        // ten sam głos po angielsku
    { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Leda' },
    { languageCode: 'en-US', name: 'en-US-Neural2-F', ssmlGender: 'FEMALE' },
  ],
};
const chosenVoice = { pl: null, en: null };   // zapamiętany działający głos
let ttsErrorShown = false;                      // pokaż błąd Google TTS tylko raz
let engineAnnounced = false;                    // raz na sesję: który silnik głosu gra
let lastTtsErrorAt = 0;                          // throttling powiadomień o błędach TTS
export let lastTtsError = '';                    // ostatni powód awarii głosu (do diagnozy)
function announceEngine(msg, kind) { if (engineAnnounced) return; engineAnnounced = true; toast(msg, kind); }
// Powiadom o awarii naturalnego głosu — z throttlingiem (max raz na 8 s)
function ttsNotify(msg) {
  lastTtsError = msg;
  const now = Date.now();
  if (now - lastTtsErrorAt > 8000) { lastTtsErrorAt = now; toast(msg, 'error'); }
}

let currentAudio = null;
let speakSeq = 0;               // numer wypowiedzi — starsze (spóźnione) audio nie zagra
const audioCache = new Map();   // cache audio po (voice|rate|text) — oszczędza koszt znaków

// --- Odblokowanie dźwięku na telefonie ---
// Telefony blokują audio, dopóki użytkownik czegoś nie dotknie. Trzymamy JEDEN
// element <audio> i „błogosławimy" go pierwszym gestem — potem gra automatycznie.
let sharedAudio = null;
let audioUnlocked = false;
function getAudioEl() {
  if (!sharedAudio) { sharedAudio = new Audio(); sharedAudio.preload = 'auto'; }
  return sharedAudio;
}
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    const a = getAudioEl();
    a.muted = true;
    a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
    setTimeout(() => { try { a.pause(); a.muted = false; } catch (e) {} }, 0);
  } catch (e) { /* ignore */ }
  try { window.speechSynthesis && window.speechSynthesis.resume(); } catch (e) {}
}
if (typeof window !== 'undefined') {
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach((ev) =>
    window.addEventListener(ev, unlockAudio, { passive: true }));
}

// Dzieli tekst na fragmenty: to co w cudzysłowie (przykłady angielskie) → 'en',
// reszta → język główny. Dzięki temu Izabela czyta angielski angielskim głosem.
// Czy fragment w cudzysłowie faktycznie wygląda na angielski?
// Izabela cytuje też POLSKIE słowa („witaj", „twoja mama") — te muszą zostać
// przy polskim głosie. Liczymy trafienia w OBU językach i wygrywa większość.
// Angielskie słowa-sygnały. Świadomie BEZ „a/i/to/an/my/do/we/was" — te są też
// polskimi słowami i myliły detekcję (polskie cytaty czytane były po angielsku).
const EN_WORDS = new Set(['hello', 'hi', 'hey', 'good', 'morning', 'evening', 'night', 'afternoon',
  'thank', 'thanks', 'you', 'please', 'name', 'is', 'are', 'am', 'yes', 'not',
  'what', 'how', 'where', 'when', 'why', 'who', 'nice', 'meet', 'the', 'it', 'me',
  'like', 'want', 'need', 'have', 'has', 'does', 'did', 'can', 'could', 'would', 'will',
  'help', 'sorry', 'bye', 'goodbye', 'see', 'later', 'day', 'coffee', 'tea', 'water', 'from',
  'been', 'were', 'this', 'that', 'your', 'his', 'her', 'they', 'he', 'she',
  'go', 'went', 'come', 'and', 'or', 'but', 'very', 'much', 'too', 'for', 'about', 'here',
  // częste angielskie słowa treściowe (żeby łapać zdania uczące)
  'get', 'got', 'make', 'made', 'take', 'took', 'tell', 'say', 'said', 'know', 'think',
  'feel', 'look', 'looking', 'work', 'working', 'play', 'playing', 'eat', 'drink', 'live',
  'love', 'speak', 'learn', 'learning', 'read', 'write', 'buy', 'sell', 'use', 'using',
  'grow', 'give', 'put', 'find', 'found', 'call', 'ask', 'try', 'keep', 'let', 'lets',
  'start', 'stop', 'open', 'close', 'turn', 'show', 'run', 'walk', 'talk', 'talking',
  'recommend', 'friendly', 'user', 'tomatoes', 'today', 'tomorrow', 'because', 'really',
  'just', 'also', 'maybe', 'okay', 'sounds', 'great', 'cool', 'fine', 'fun', 'people',
  'time', 'thing', 'things', 'love', 'best', 'more', 'well', 'right', 'back', 'now']);
const PL_WORDS = new Set(['witaj', 'witajcie', 'czesc', 'siema', 'dzien', 'dobry', 'dobra', 'dziekuje',
  'prosze', 'przepraszam', 'tak', 'nie', 'jest', 'czy', 'sie', 'na', 'po', 'ja', 'ty', 'wy',
  'dobrze', 'ale', 'juz', 'moze', 'mama', 'tata', 'twoja', 'twoj', 'moja', 'moj', 'jak', 'masz',
  'mam', 'imie', 'nazywam', 'znaczy', 'mowie', 'lubie', 'chce', 'jestem', 'jutro', 'dzis', 'wczoraj',
  'to', 'bardzo', 'polecam', 'czyli', 'oznacza', 'powiedz', 'sprobuj', 'teraz', 'razem', 'wlasnie',
  'gadamy', 'lecimy', 'cisniemy', 'spokojnie', 'super', 'brawo', 'ciekawe', 'fajnie', 'mordeczko']);
// Typowe polskie końcówki (nawet bez ogonków) — łapią słowa spoza listy.
const PL_SUFFIX = /(am|em|asz|esz|isz|ysz|amy|emy|imy|ymy|acie|ecie|aja|eja|uje|uja|owal|liśmy|lismy|lem|lam|nia|cja|sja|osc|osci|ego|emu|ami|ach)$/;
export function isEnglishText(s) {
  if (/[ąćęłńóśźż]/i.test(s)) return false;               // polskie znaki → polski
  const words = (String(s).toLowerCase().match(/[a-z']+/g) || []);
  if (!words.length) return false;
  let en = 0, pl = 0;
  for (const w of words) {
    if (PL_WORDS.has(w)) { pl++; continue; }
    if (EN_WORDS.has(w)) { en++; continue; }
    if (w.length >= 4 && PL_SUFFIX.test(w)) pl++;          // polska morfologia
  }
  if (pl > 0) return false;                               // JAKIKOLWIEK polski sygnał → polski
  if (en >= 1) return true;                               // wyraźne angielskie słowo → angielski
  return false;                                           // niepewne → czytaj głosem głównym (polskim)
}
const looksEnglish = isEnglishText;

// Dzieli tekst na zdania (bez lookbehind — zgodne wszędzie).
export function splitSentences(t) {
  return (String(t || '').match(/[^.!?]+[.!?]*/g) || [String(t || '')])
    .map((s) => s.trim()).filter(Boolean);
}

function splitByQuotes(text, primary) {
  const QUOTE = /["„“”»«]/;
  const out = [];
  let buf = '', inQ = false;
  const push = () => {
    const t = buf.trim();
    if (t) out.push({ text: t, lang: inQ && looksEnglish(t) ? 'en' : primary });
    buf = '';
  };
  for (const ch of text) {
    if (QUOTE.test(ch)) { push(); inQ = !inQ; continue; }
    buf += ch;
  }
  push();

  // Fragmenty z samą interpunkcją („?", „,") doklejamy do sąsiada —
  // inaczej lektor czyta „znak zapytania". Potem sklejamy sąsiadów
  // w tym samym języku (mniej zapytań, płynniejsza mowa).
  const merged = [];
  for (const seg of out) {
    const hasWord = /[a-z0-9ąćęłńóśźż]/i.test(seg.text);
    const last = merged[merged.length - 1];
    if (!hasWord) {
      if (last) last.text += seg.text;
      continue;                        // sama interpunkcja bez poprzednika → pomijamy
    }
    if (last && last.lang === seg.lang) last.text += ' ' + seg.text;
    else merged.push({ ...seg });
  }
  return merged.length ? merged : [{ text, lang: primary }];
}

async function gttsOnce(text, v, rate) {
  // Chirp3-HD potrafi przeciągać słowa — delikatnie przyspieszamy (1.07x),
  // tempo zawsze w bezpiecznych widełkach.
  const isChirp = /chirp/i.test(v.name);
  const eff = Math.min(1.25, Math.max(0.85, (rate || 1) * (isChirp ? 1.07 : 1)));
  const audioConfig = { audioEncoding: 'MP3', speakingRate: eff };
  // Przy przejściowym błędzie (429/503) ponawiamy TEN SAM głos zamiast
  // przeskakiwać na inny — Izabela ma brzmieć zawsze tak samo.
  let res = null, errText = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1200));
    res = await fetch(gttsSynthUrl(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { text }, voice: v, audioConfig }),
    });
    if (res.ok) break;
    errText = (await res.text()).slice(0, 220);
    if (res.status !== 429 && res.status !== 503) break;
  }
  if (!res || !res.ok) throw new Error('Google TTS ' + (res ? res.status : '?') + ': ' + errText);
  const data = await res.json();
  return 'data:audio/mp3;base64,' + data.audioContent;
}

async function gttsUrl(text, langKey, rate) {
  const key = langKey === 'en' ? 'en' : 'pl';
  // Pamiętamy działający głos, ALE zapasowy nie przykleja się na zawsze:
  // po 90 s znów próbujemy najlepszego (Chirp3-HD), żeby chwilowa czkawka
  // nie skazywała całej sesji na gorszy, robotyczny głos.
  const ladder = GTTS_VOICES[key];
  const mem = chosenVoice[key];
  const memStale = mem && mem.idx > 0 && Date.now() - mem.ts > 90000;
  const candidates = mem && !memStale ? [mem.v] : ladder;
  let lastErr = null;
  for (const v of candidates) {
    const cacheKey = v.name + '|' + rate + '|' + text;
    const cached = audioCache.get(cacheKey);
    if (cached) { chosenVoice[key] = { v, idx: ladder.indexOf(v), ts: Date.now() }; return cached; }
    try {
      const url = await gttsOnce(text, v, rate);
      chosenVoice[key] = { v, idx: ladder.indexOf(v), ts: Date.now() };
      console.info('[TTS] głos:', v.name);
      audioCache.set(cacheKey, url);
      return url;
    } catch (e) { lastErr = e; /* spróbuj kolejny głos z drabinki */ }
  }
  throw lastErr || new Error('Google TTS: brak działającego głosu');
}

async function speakGoogle(text, { lang = 'pl-PL', rate = 1, onEnd } = {}) {
  const my = ++speakSeq;
  try {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    // O języku decyduje TREŚĆ, nie etykietka: jeśli w tekście są polskie znaki,
    // to zdanie jest polskie (z angielskimi cytatami), nawet gdy AI oznaczyło 'en'.
    // Inaczej angielski lektor czytał polski tekst „bez ogonków".
    const hasPolish = /[ąćęłńóśźż]/i.test(text);
    const primary = hasPolish ? 'pl' : lang.slice(0, 2).toLowerCase();
    // W ścieżce bez podziału (jednolity język) też USUWAMY cudzysłowy —
    // inaczej lektor czyta znak cudzysłowu i robi „dziwne dźwięki".
    const stripQ = (t) => t.replace(/["„“”»«]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    const segments = primary === 'pl' ? splitByQuotes(text, 'pl') : [{ text: stripQ(text), lang: primary }];
    // Zsyntetyzuj wszystkie fragmenty z góry — jeśli KTÓRYKOLWIEK padnie, lecimy
    // na zapasowy głos (żeby uczeń zawsze coś usłyszał), a błąd pokazujemy raz.
    const urls = [];
    // Tempo nigdy poniżej 0.85 — wolniej brzmi jak zepsuty robot
    const baseRate = Math.max(0.85, rate || 1);
    for (const seg of segments) {
      const segRate = seg.lang === 'en' ? Math.max(0.85, baseRate * 0.9) : baseRate;
      urls.push(await gttsUrl(seg.text, seg.lang, segRate));
    }
    // Ktoś zaczął mówić później — ustępujemy. onEnd dostaje {cancelled:true},
    // żeby łańcuszki (onEnd → kolejna kwestia) NIE odzywały się na nowszej wypowiedzi.
    if (my !== speakSeq) { onEnd?.({ cancelled: true }); return; }
    // Gramy przez WSPÓŁDZIELONY element audio, który został odblokowany pierwszym
    // gestem użytkownika. Nowe `new Audio()` po asynchronicznej syntezie bywa
    // blokowane przez autoplay (gest już „wygasł") — stąd cisza do kliknięcia.
    const audioEl = getAudioEl();
    audioEl.muted = false;
    currentAudio = audioEl;
    let i = 0;
    const playNext = () => {
      if (my !== speakSeq) { onEnd?.({ cancelled: true }); return; }  // nowsza wypowiedź przejęła głos
      if (i >= urls.length) { onEnd?.(); return; }
      audioEl.src = urls[i++];
      audioEl.onended = () => playNext();
      audioEl.onerror = () => playNext();
      const p = audioEl.play();
      if (p && p.catch) p.catch(() => {
        // Gdyby mimo wszystko zablokowane — dogrywamy po pierwszym geście, bez gubienia kwestii
        const retry = () => { if (my === speakSeq) audioEl.play().catch(() => playNext()); };
        window.addEventListener('pointerdown', retry, { once: true });
      });
    };
    playNext();
  } catch (e) {
    console.warn('[GoogleTTS] fallback:', e);
    ttsNotify('Głos Cloud TTS nie zadziałał: ' + (e.message || e));
    // Zapas nr 1: głos Gemini; dopiero potem głos przeglądarki
    if (hasGeminiTTS()) return speakGemini(text, { lang, rate, onEnd });
    speakWeb(text, { lang, onEnd });
  }
}

async function speakEleven(text, { onEnd, rate } = {}) {
  try {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    const voice = ls(EL_VOICE);
    const cacheKey = voice + '|' + text;
    let url = audioCache.get(cacheKey);
    if (!url) {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
        method: 'POST',
        headers: { 'xi-api-key': ls(EL_KEY), 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
        }),
      });
      if (!res.ok) throw new Error('ElevenLabs ' + res.status + ': ' + (await res.text()).slice(0, 160));
      url = URL.createObjectURL(await res.blob());
      audioCache.set(cacheKey, url);
    }
    const audio = new Audio(url);
    if (rate) audio.playbackRate = rate;
    currentAudio = audio;
    audio.onended = () => { if (currentAudio === audio) currentAudio = null; onEnd?.(); };
    audio.onerror = () => onEnd?.();
    await audio.play();
  } catch (e) {
    console.warn('[ElevenLabs] fallback do głosu przeglądarki:', e);
    speakWeb(text, { onEnd });
  }
}

// ---- Gemini natywny TTS (naturalny głos na kluczu Gemini — bez Google Cloud TTS) ----
const GEMINI_VOICE = 'Leda';                 // ciepły, kobiecy głos
const GEMINI_KEY_STORE = 'pogadajse.geminiKey';
function genLangKey() { return (ls(GEMINI_KEY_STORE) || (CONFIG.GEMINI.apiKey || '')).trim(); }
// Głos Gemini dostępny gdy: proxy (dla wszystkich) lub klucz (CONFIG/użytkownika)
const hasGeminiTTS = () => geminiConfigured() || !!genLangKey();

// Surowe PCM (L16, mono) z Gemini → WAV data-blob do odtworzenia w przeglądarce
function pcmToWavUrl(base64, sampleRate) {
  const bin = atob(base64), len = bin.length;
  const buf = new ArrayBuffer(44 + len), view = new DataView(buf);
  const wr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); view.setUint32(4, 36 + len, true); wr(8, 'WAVE');
  wr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  wr(36, 'data'); view.setUint32(40, len, true);
  for (let i = 0; i < len; i++) view.setUint8(44 + i, bin.charCodeAt(i));
  return URL.createObjectURL(new Blob([view], { type: 'audio/wav' }));
}

async function geminiTtsUrl(text) {
  const cacheKey = 'gem|' + GEMINI_VOICE + '|' + text;
  const cached = audioCache.get(cacheKey);
  if (cached) return cached;
  // Limity "na minutę" zdarzają się przy żywszym klikaniu — ponawiamy 2 razy,
  // zanim zejdziemy na głos zapasowy.
  let res = null, lastErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, attempt * 2000));
    res = await fetch(genContentUrl(CONFIG.GEMINI.ttsModel, genLangKey()), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: { responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICE } } } },
      }),
    });
    if (res.ok) break;
    lastErr = 'Gemini TTS ' + res.status + ': ' + (await res.text()).slice(0, 200);
    if (res.status !== 429 && res.status !== 503) throw new Error(lastErr);
  }
  if (!res || !res.ok) throw new Error(lastErr || 'Gemini TTS: brak odpowiedzi');
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const inline = parts.map((p) => p.inlineData || p.inline_data).find((d) => d && d.data);
  if (!inline) throw new Error('Gemini TTS: brak audio w odpowiedzi');
  const mime = inline.mimeType || inline.mime_type || 'audio/L16;rate=24000';
  const sr = parseInt((mime.match(/rate=(\d+)/) || [])[1] || '24000', 10);
  const url = pcmToWavUrl(inline.data, sr);
  audioCache.set(cacheKey, url);
  return url;
}

async function speakGemini(text, { lang = 'pl-PL', rate = 1, onEnd } = {}) {
  const my = ++speakSeq;
  try {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    if (currentAudio) { try { currentAudio.pause(); } catch (e) {} }
    const url = await geminiTtsUrl(text);
    if (my !== speakSeq) { onEnd?.({ cancelled: true }); return; }   // nowsza wypowiedź przejęła głos
    const audio = getAudioEl();           // współdzielony, odblokowany element (mobile)
    audio.muted = false;
    audio.playbackRate = (rate && rate < 1) ? Math.max(0.85, rate) : 1;
    audio.onended = () => { if (currentAudio === audio) currentAudio = null; onEnd?.(); };
    audio.onerror = () => onEnd?.();
    currentAudio = audio;
    audio.src = url;
    await audio.play();
  } catch (e) {
    console.warn('[GeminiTTS] fallback:', e);
    ttsNotify('Głos Gemini nie zadziałał: ' + (e.message || e) + ' — używam zapasowego (robot).');
    return speakWeb(text, { lang, onEnd });   // bez ping-ponga Google<->Gemini
  }
}

function speakWeb(clean, { lang = CONFIG.SPEECH.ttsLang, rate = 1, pitch = 1.0, onEnd } = {}) {
  ++speakSeq;                      // unieważnij trwające syntezy innych silników
  if (!('speechSynthesis' in window) || !clean) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = lang; u.rate = rate; u.pitch = pitch;
  const pickVoice = () => {
    const pref = lang.slice(0, 2).toLowerCase();
    const voices = window.speechSynthesis.getVoices();
    const inLang = voices.filter((v) => v.lang?.toLowerCase().startsWith(pref));
    const pool = inLang.length ? inLang : voices;
    // Cel: najbardziej ludzki, ŻEŃSKI głos. Sieciowe (naturalne) > lokalne (robot).
    const score = (v) => {
      const n = (v.name || '').toLowerCase();
      let s = 0;
      if (v.localService === false) s += 5;                          // głos sieciowy/neuronowy
      if (/natural|neural|online|wavenet|studio|google/.test(n)) s += 4;
      if (/female|woman|kobieta|zofia|agnieszka|ewa|paulina|maja|zosia|alicja|samantha|aria|zira|jenny|ava|emma|libby|michelle/.test(n)) s += 2;
      if (/espeak|festival|pico|robot/.test(n)) s -= 5;              // ewidentnie syntetyczne
      if (v.lang?.toLowerCase() === lang.toLowerCase()) s += 1;
      return s;
    };
    u.voice = pool.slice().sort((a, b) => score(b) - score(a))[0] || voices[0] || null;
    window.speechSynthesis.speak(u);
  };
  u.onend = () => onEnd?.();
  if (window.speechSynthesis.getVoices().length) pickVoice();
  else window.speechSynthesis.addEventListener('voiceschanged', pickVoice, { once: true });
}

export const speech = {
  isRecognitionSupported() { return !!SR; },
  isTtsSupported() { return 'speechSynthesis' in window; },

  // --- Rozpoznawanie mowy (STT) ---
  // onResult(text, isFinal), onEnd(), onError(err)
  listen({ lang = CONFIG.SPEECH.recognitionLang, interim = true, onResult, onEnd, onError } = {}) {
    if (!SR) { onError?.(new Error('SpeechRecognition niedostępne w tej przeglądarce')); return { stop() {} }; }
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = interim;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      onResult?.(res[0].transcript.trim(), res.isFinal);
    };
    rec.onerror = (e) => onError?.(e.error || e);
    rec.onend = () => onEnd?.();

    try { rec.start(); } catch (e) { onError?.(e); }
    return { stop() { try { rec.stop(); } catch (e) {} } };
  },

  // --- Synteza mowy (TTS) — głos Izabeli ---
  // Priorytet: Google Cloud TTS (Chirp 3 HD — skalowalny, wysokie limity)
  //            → Gemini TTS (zapas) → ElevenLabs → głos przeglądarki.
  speak(text, opts = {}) {
    const clean = forSpeech(text);
    if (!clean) { opts.onEnd?.(); return; }
    if (hasGoogleTTS()) return speakGoogle(clean, opts);
    if (hasGeminiTTS()) return speakGemini(clean, opts);
    if (hasEleven()) return speakEleven(clean, opts);
    return speakWeb(clean, opts);
  },

  // Mówi kolejno zdania z listy, wołając onPart(tekst, i) PRZED każdym —
  // dzięki temu dymek pokazuje krótkie kwestie po kolei, zamiast jednej wielkiej.
  // onDone odpala się dopiero po ostatnim (nie po przerwaniu nową wypowiedzią).
  speakSequence(parts, { lang = 'pl-PL', onPart, onDone } = {}) {
    const list = (parts || []).map((s) => String(s).trim()).filter(Boolean);
    const run = (i) => {
      if (i >= list.length) { onDone?.(); return; }
      onPart?.(list[i], i);
      this.speak(list[i], { lang, onEnd: (e) => { if (!e || !e.cancelled) run(i + 1); } });
    };
    run(0);
  },

  // Odblokuj dźwięk na telefonie (wywołaj na geście wejścia w lekcję)
  unlockAudio() { unlockAudio(); },

  stopSpeaking() {
    ++speakSeq;                    // ucisza też wypowiedzi w trakcie syntezy
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (currentAudio) { try { currentAudio.pause(); } catch (e) {} currentAudio = null; }
  },

  // --- Nagrywanie audio (do analizy wymowy przez Gemini) ---
  canRecord() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== 'undefined');
  },
  async recordAudio({ autoStop = false, onStop, maxMs = 20000, silenceMs = 1500 } = {}) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    let mime = '';
    for (const m of ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4']) {
      if (MediaRecorder.isTypeSupported(m)) { mime = m; break; }
    }
    const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

    // Auto-stop po ciszy — żeby uczeń klikał tylko START, a nagranie samo się kończy
    let ac = null, raf = null, stopped = false;
    const stopNow = () => { if (!stopped) { stopped = true; try { mr.stop(); } catch (e) {} } };
    if (autoStop) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const src = ac.createMediaStreamSource(stream);
        const an = ac.createAnalyser(); an.fftSize = 1024;
        src.connect(an);
        const buf = new Uint8Array(an.fftSize);
        const t0 = performance.now();
        let spokeAt = 0, lastLoud = 0;
        const tick = () => {
          if (stopped) return;
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
          const rms = Math.sqrt(sum / buf.length);
          const now = performance.now();
          if (rms > 0.045) { if (!spokeAt) spokeAt = now; lastLoud = now; }
          if (spokeAt && now - lastLoud > silenceMs) return stopNow();   // cisza po wypowiedzi
          if (!spokeAt && now - t0 > 6000) return stopNow();             // nic nie powiedziano
          if (now - t0 > maxMs) return stopNow();                        // limit bezpieczeństwa
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) { /* brak AudioContext — zostaje ręczny Stop */ }
    }

    const done = new Promise((resolve) => {
      mr.onstop = async () => {
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
        if (ac) { try { ac.close(); } catch (e) {} }
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || mime || 'audio/webm' });
        resolve({ base64: await blobToBase64(blob), mimeType: (mr.mimeType || mime || 'audio/webm').split(';')[0] });
        onStop?.();
      };
    });
    mr.start();
    return { stop: stopNow, done };
  },
};

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(',')[1] || '');
    r.readAsDataURL(blob);
  });
}

// Usuwa emoji/piktogramy z tekstu PRZED czytaniem (tekst na ekranie zostaje bez zmian)
function forSpeech(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}‍️⃣]/gu, '')
    // samotne „US" (wielkimi) TTS czytał jako „U S"; w lekcji to zaimek „us"
    .replace(/\bUS\b/g, 'us')
    .replace(/\/(aś|eś|am|em|ą|a)(?![a-ząćęłńóśźż])/gi, '')   // resztki form „zrobiłeś/aś" — nie czytamy ukośnika
    .replace(/[—–]/g, ',')                     // myślnik = pauza, nie „minus"
    .replace(/…|\.{3,}/g, ',')                  // wielokropek = pauza, nie „yyy"
    .replace(/\*/g, '')                        // gwiazdki markdown — nie czytamy
    .replace(/''+|’’+|`+/g, ' ')               // podwójne apostrofy/backticki — lektor czytał bełkot
    .replace(/[„“"]\s*[”“"]/g, ' ')            // pusty cudzysłów („") — nic do przeczytania
    .replace(/\s-\s/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
