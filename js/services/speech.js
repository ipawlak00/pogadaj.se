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
    if (!('speechSynthesis' in window) || !text) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = rate; u.pitch = pitch;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const byLang = voices.filter((v) => v.lang?.toLowerCase().startsWith(lang.slice(0, 2)));
      const female = byLang.find((v) => /female|woman|zira|google|samantha|aria/i.test(v.name));
      u.voice = female || byLang[0] || voices[0] || null;
      window.speechSynthesis.speak(u);
    };
    u.onend = () => onEnd?.();
    // Głosy ładują się asynchronicznie w niektórych przeglądarkach
    if (window.speechSynthesis.getVoices().length) pickVoice();
    else window.speechSynthesis.addEventListener('voiceschanged', pickVoice, { once: true });
  },

  stopSpeaking() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); },
};
