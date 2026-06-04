// =============================================================
//  Speech — warstwa mowy (STT + TTS) na Web Speech API
// -------------------------------------------------------------
//  Działa w przeglądarce bez kluczy. Później można podmienić STT
//  na Whisper (przez proxy), zachowując ten sam interfejs.
// =============================================================

import { CONFIG } from '../config.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

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
  // Wybieramy żeński głos dla danego języka jeśli dostępny.
  speak(text, { lang = CONFIG.SPEECH.ttsLang, rate = 1, pitch = 1.05, onEnd } = {}) {
    const clean = forSpeech(text);
    if (!('speechSynthesis' in window) || !clean) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = lang; u.rate = rate; u.pitch = pitch;

    const pickVoice = () => {
      const pref = lang.slice(0, 2).toLowerCase();
      const voices = window.speechSynthesis.getVoices();
      const inLang = voices.filter((v) => v.lang?.toLowerCase().startsWith(pref));
      // Punktacja: naturalne głosy Google + żeńskie + dokładny język
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
  },

  stopSpeaking() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); },
};

// Usuwa emoji/piktogramy z tekstu PRZED czytaniem (tekst na ekranie zostaje bez zmian)
function forSpeech(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}‍️⃣]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
