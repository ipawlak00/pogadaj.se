// =============================================================
//  Speech — warstwa mowy (STT + TTS)
// -------------------------------------------------------------
//  STT: Web Speech API.
//  TTS: jeśli skonfigurowano ElevenLabs (klucz + Voice ID) → mówi
//       sklonowanym głosem (PL+EN). Inaczej → wbudowany głos przeglądarki.
// =============================================================

import { CONFIG } from '../config.js';

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

// Głosy Izabeli wg języka (żeńskie, naturalne WaveNet)
const GTTS_VOICE = {
  pl: { languageCode: 'pl-PL', name: 'pl-PL-Wavenet-A', ssmlGender: 'FEMALE' },
  en: { languageCode: 'en-US', name: 'en-US-Wavenet-F', ssmlGender: 'FEMALE' },
};

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

async function gttsUrl(text, langKey, rate) {
  const v = GTTS_VOICE[langKey] || GTTS_VOICE.pl;
  const cacheKey = v.name + '|' + rate + '|' + text;
  let url = audioCache.get(cacheKey);
  if (!url) {
    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${ls(GTTS_KEY)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { text }, voice: v, audioConfig: { audioEncoding: 'MP3', speakingRate: rate || 1 } }),
    });
    if (!res.ok) throw new Error('Google TTS ' + res.status + ': ' + (await res.text()).slice(0, 200));
    const data = await res.json();
    url = 'data:audio/mp3;base64,' + data.audioContent;
    audioCache.set(cacheKey, url);
  }
  return url;
}

async function speakGoogle(text, { lang = 'pl-PL', rate = 1, onEnd } = {}) {
  try {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    const primary = lang.slice(0, 2).toLowerCase();
    // Mieszany PL+EN tylko gdy główny język to polski (przykłady w cudzysłowie)
    const segments = primary === 'pl' ? splitByQuotes(text, 'pl') : [{ text, lang: primary }];
    let i = 0;
    const playNext = async () => {
      if (i >= segments.length) { onEnd?.(); return; }
      const seg = segments[i++];
      // Angielski czytamy wyraźnie wolniej (uczeń ma nadążyć i powtórzyć)
      const segRate = seg.lang === 'en' ? (rate || 1) * 0.82 : (rate || 1);
      try {
        const url = await gttsUrl(seg.text, seg.lang, segRate);
        const audio = new Audio(url);
        currentAudio = audio;
        audio.onended = () => { if (currentAudio === audio) currentAudio = null; playNext(); };
        audio.onerror = () => playNext();
        await audio.play();
      } catch (e) { console.warn('[GoogleTTS seg]', e); playNext(); }
    };
    await playNext();
  } catch (e) {
    console.warn('[GoogleTTS] fallback do głosu przeglądarki:', e);
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

function speakWeb(clean, { lang = CONFIG.SPEECH.ttsLang, rate = 1, pitch = 1.05, onEnd } = {}) {
  if (!('speechSynthesis' in window) || !clean) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = lang; u.rate = rate; u.pitch = pitch;
  const pickVoice = () => {
    const pref = lang.slice(0, 2).toLowerCase();
    const voices = window.speechSynthesis.getVoices();
    const inLang = voices.filter((v) => v.lang?.toLowerCase().startsWith(pref));
    const score = (v) => {
      let s = 0;
      if (/google|natural|neural/i.test(v.name)) s += 3;
      if (/female|woman|kobieta|zofia|ewa|agnieszka|paulina|maja|zosia|samantha|aria|zira|jenny/i.test(v.name)) s += 2;
      if (v.lang?.toLowerCase() === lang.toLowerCase()) s += 1;
      return s;
    };
    u.voice = inLang.sort((a, b) => score(b) - score(a))[0] || voices[0] || null;
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
  // Priorytet: Google Cloud TTS → ElevenLabs → wbudowany głos przeglądarki.
  speak(text, opts = {}) {
    const clean = forSpeech(text);
    if (!clean) { opts.onEnd?.(); return; }
    if (hasGoogleTTS()) return speakGoogle(clean, opts);
    if (hasEleven()) return speakEleven(clean, opts);
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
  async recordAudio() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    let mime = '';
    for (const m of ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4']) {
      if (MediaRecorder.isTypeSupported(m)) { mime = m; break; }
    }
    const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((resolve) => {
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || mime || 'audio/webm' });
        resolve({ base64: await blobToBase64(blob), mimeType: (mr.mimeType || mime || 'audio/webm').split(';')[0] });
      };
    });
    mr.start();
    return { stop: () => { try { mr.stop(); } catch (e) {} }, done };
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
