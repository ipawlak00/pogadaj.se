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

// ---- Google Cloud Text-to-Speech (preferowane: jeden rachunek z Firebase/Gemini) ----
const GTTS_KEY = 'pogadajse.gttsKey';
export function setGoogleTTSKey(key) {
  try { key ? localStorage.setItem(GTTS_KEY, key.trim()) : localStorage.removeItem(GTTS_KEY); } catch {}
}
export function hasGoogleTTS() { return !!ls(GTTS_KEY); }

// Głosy Izabeli wg języka — od najbardziej naturalnego do zapasowego.
// Pierwszy, który zadziała na danym kluczu/projekcie, zostaje zapamiętany.
const GTTS_VOICES = {
  pl: [
    { languageCode: 'pl-PL', name: 'pl-PL-Chirp3-HD-Leda' },           // najnaturalniejszy (HD)
    { languageCode: 'pl-PL', name: 'pl-PL-Wavenet-A', ssmlGender: 'FEMALE' },
    { languageCode: 'pl-PL', name: 'pl-PL-Standard-A', ssmlGender: 'FEMALE' },
  ],
  en: [
    { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Leda' },
    { languageCode: 'en-US', name: 'en-US-Neural2-F', ssmlGender: 'FEMALE' },
    { languageCode: 'en-US', name: 'en-US-Wavenet-F', ssmlGender: 'FEMALE' },
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
const audioCache = new Map();   // cache audio po (voice|rate|text) — oszczędza koszt znaków

// Dzieli tekst na fragmenty: to co w cudzysłowie (przykłady angielskie) → 'en',
// reszta → język główny. Dzięki temu Izabela czyta angielski angielskim głosem.
function splitByQuotes(text, primary) {
  const QUOTE = /["„“”»«]/;
  const out = [];
  let buf = '', inQ = false;
  for (const ch of text) {
    if (QUOTE.test(ch)) {
      if (buf.trim()) out.push({ text: buf.trim(), lang: inQ ? 'en' : primary });
      buf = ''; inQ = !inQ; continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push({ text: buf.trim(), lang: inQ ? 'en' : primary });
  return out.length ? out : [{ text, lang: primary }];
}

async function gttsOnce(text, v, rate) {
  // Głosy Chirp3-HD nie wspierają speakingRate — pomijamy je dla nich.
  const isChirp = /chirp/i.test(v.name);
  const audioConfig = isChirp ? { audioEncoding: 'MP3' } : { audioEncoding: 'MP3', speakingRate: rate || 1 };
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${ls(GTTS_KEY)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: { text }, voice: v, audioConfig }),
  });
  if (!res.ok) throw new Error('Google TTS ' + res.status + ': ' + (await res.text()).slice(0, 220));
  const data = await res.json();
  return 'data:audio/mp3;base64,' + data.audioContent;
}

async function gttsUrl(text, langKey, rate) {
  const key = langKey === 'en' ? 'en' : 'pl';
  // Jeśli już wiemy, który głos działa — użyj tylko jego.
  const candidates = chosenVoice[key] ? [chosenVoice[key]] : GTTS_VOICES[key];
  let lastErr = null;
  for (const v of candidates) {
    const cacheKey = v.name + '|' + rate + '|' + text;
    const cached = audioCache.get(cacheKey);
    if (cached) { chosenVoice[key] = v; return cached; }
    try {
      const url = await gttsOnce(text, v, rate);
      chosenVoice[key] = v;                 // zapamiętaj działający głos
      audioCache.set(cacheKey, url);
      return url;
    } catch (e) { lastErr = e; /* spróbuj kolejny głos z drabinki */ }
  }
  throw lastErr || new Error('Google TTS: brak działającego głosu');
}

async function speakGoogle(text, { lang = 'pl-PL', rate = 1, onEnd } = {}) {
  try {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    const primary = lang.slice(0, 2).toLowerCase();
    // Mieszany PL+EN tylko gdy główny język to polski (przykłady w cudzysłowie)
    const segments = primary === 'pl' ? splitByQuotes(text, 'pl') : [{ text, lang: primary }];
    // Zsyntetyzuj wszystkie fragmenty z góry — jeśli KTÓRYKOLWIEK padnie, lecimy
    // na zapasowy głos (żeby uczeń zawsze coś usłyszał), a błąd pokazujemy raz.
    const urls = [];
    for (const seg of segments) {
      const segRate = seg.lang === 'en' ? (rate || 1) * 0.82 : (rate || 1);   // angielski wolniej
      urls.push(await gttsUrl(seg.text, seg.lang, segRate));
    }
    let i = 0;
    const playNext = () => {
      if (i >= urls.length) { onEnd?.(); return; }
      const audio = new Audio(urls[i++]);
      currentAudio = audio;
      audio.onended = () => { if (currentAudio === audio) currentAudio = null; playNext(); };
      audio.onerror = () => playNext();
      audio.play().catch(() => playNext());
    };
    playNext();
  } catch (e) {
    console.warn('[GoogleTTS] fallback do głosu przeglądarki:', e);
    if (!ttsErrorShown) {
      ttsErrorShown = true;
      toast('Głos Google nie zadziałał (' + (e.message || e) + '). Używam zapasowego. Sprawdź, czy ten klucz ma włączone „Cloud Text-to-Speech API".', 'error');
    }
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
  const res = await fetch(genContentUrl(CONFIG.GEMINI.ttsModel, genLangKey()), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICE } } } },
    }),
  });
  if (!res.ok) throw new Error('Gemini TTS ' + res.status + ': ' + (await res.text()).slice(0, 200));
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
  try {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    const url = await geminiTtsUrl(text);
    const audio = new Audio(url);
    if (rate && rate < 1) audio.playbackRate = Math.max(0.85, rate);   // delikatne zwolnienie
    currentAudio = audio;
    audio.onended = () => { if (currentAudio === audio) currentAudio = null; onEnd?.(); };
    audio.onerror = () => onEnd?.();
    await audio.play();
  } catch (e) {
    console.warn('[GeminiTTS] fallback:', e);
    ttsNotify('Głos Gemini nie zadziałał: ' + (e.message || e) + ' — używam zapasowego (robot).');
    if (hasGoogleTTS()) return speakGoogle(text, { lang, rate, onEnd });
    return speakWeb(text, { lang, onEnd });
  }
}

function speakWeb(clean, { lang = CONFIG.SPEECH.ttsLang, rate = 1, pitch = 1.0, onEnd } = {}) {
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
  // Priorytet: Gemini (naturalny, ten sam klucz co AI) → Google Cloud TTS
  //            → ElevenLabs → wbudowany głos przeglądarki.
  speak(text, opts = {}) {
    const clean = forSpeech(text);
    if (!clean) { opts.onEnd?.(); return; }
    if (hasGeminiTTS()) { announceEngine('Głos: Gemini (naturalny, kobiecy)'); return speakGemini(clean, opts); }
    if (hasGoogleTTS()) { announceEngine('Głos: Google TTS (naturalny)'); return speakGoogle(clean, opts); }
    if (hasEleven()) { announceEngine('Głos: ElevenLabs (naturalny)'); return speakEleven(clean, opts); }
    announceEngine('Głos: przeglądarka (zapasowy, robotyczny). Podłącz Izabelę z AI (Gemini), aby brzmiała naturalnie.', 'error');
    return speakWeb(clean, opts);
  },

  stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
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
    .replace(/\s{2,}/g, ' ')
    .trim();
}
