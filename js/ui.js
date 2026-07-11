// =============================================================
//  UI — drobne helpery DOM (bez frameworka)
// =============================================================

import { CONFIG } from './config.js';
import { setGeminiKey, hasGeminiKey } from './services/ai.js';
import { setGoogleTTSKey, hasGoogleTTS } from './services/speech.js';

// Twórca elementów: el('div.card', { onclick }, [children])
export function el(selector, props = {}, children = []) {
  const [tag, ...classes] = selector.split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

// ---------- Opinie: „zostaw opinię Izabeli!" ----------
// Dymek w rogu każdego widoku + okienko z pochyłą podpowiedzią.
// Opinie lecą na serwer (kolekcja feedback, adresat: izabela@izabelacode.pl).
export function feedbackCorner(page) {
  return el('button.feedback-corner', { onclick: () => openFeedback(page), title: 'Podziel się wrażeniami' },
    ['zostaw opinię Izabeli']);
}

export function openFeedback(page) {
  const area = el('textarea.feedback-text', {
    placeholder: 'Napisz, co myślisz o aplikacji i lekcji. Coś nie działało? Masz pomysł, co poprawić albo naprawić? Pisz śmiało, czytam wszystko.',
    maxlength: '4000',
  });
  const sendBtn = el('button.btn.btn--primary.btn--block', { onclick: send }, ['Wyślij do Izabeli']);
  const overlay = el('div.level-overlay', {
    onclick: (e) => { if (e.target === overlay) overlay.remove(); },
  }, [
    el('div.level-box.feedback-box', {}, [
      el('button.level-close', { onclick: () => overlay.remove(), 'aria-label': 'Zamknij' }, ['X']),
      el('h2.display', { style: 'margin:0 0 4px;color:#14314f', text: 'Zostaw opinię Izabeli' }),
      el('p', { style: 'margin:0 0 12px;color:#46688c', text: 'Każda uwaga trafia prosto do autorki. Dzięki.' }),
      area,
      sendBtn,
    ]),
  ]);

  async function send() {
    const text = area.value.trim();
    if (!text) { toast('Napisz chociaż słowo, mordeczko', 'error'); return; }
    sendBtn.disabled = true; sendBtn.textContent = 'Wysyłam…';
    try {
      const base = (CONFIG.GEMINI.proxyBase || '').replace(/\/$/, '');
      const st = JSON.parse(localStorage.getItem('pogadajse.state') || '{}');
      const res = await fetch(base + '/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, page: page || '', email: st.user?.email || '', name: st.user?.name || '' }),
      });
      if (!res.ok) throw new Error('send failed');
      overlay.remove();
      toast('Dzięki, opinia poleciała do Izabeli.');
    } catch (e) {
      sendBtn.disabled = false; sendBtn.textContent = 'Wyślij do Izabeli';
      toast('Nie udało się wysłać. Spróbuj za chwilę.', 'error');
    }
  }

  document.body.append(overlay);
  setTimeout(() => area.focus(), 50);
}

export function toast(message, type = '') {
  const wrap = document.getElementById('toasts');
  const t = el(`div.toast${type ? '.toast--' + type : ''}`, { text: message });
  wrap.append(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3200);
}

export function topbar(rightNode) {
  return el('header.topbar', {}, [
    el('div.logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
    rightNode || el('span'),
  ]);
}

export const navigate = (hash) => { location.hash = hash; };

// Przycisk podłączenia prawdziwego AI (Gemini). Klucz wpisuje użytkownik u siebie
// — trafia tylko do localStorage tego urządzenia, nigdy do repo.
export function aiConnectButton() {
  const connected = hasGeminiKey();
  return el('button.btn.btn--ghost', { style: 'font-size:.8rem',
    onclick: () => {
      const k = prompt('Wklej swój klucz Gemini API (z aistudio.google.com).\n\nKlucz zostaje TYLKO na tym urządzeniu — nie wysyłamy go nigdzie poza Google ani nie zapisujemy w kodzie.');
      if (k && k.trim()) { setGeminiKey(k); location.reload(); }
    },
  }, [connected ? 'Izabela AI: połączona (zmień klucz)' : 'Połącz Izabelę z prawdziwym AI']);
}

// Przycisk podłączenia GŁOSU Izabeli (Google Cloud Text-to-Speech).
// Klucz zapisywany tylko na urządzeniu (localStorage).
export function voiceConnectButton() {
  const connected = hasGoogleTTS();
  return el('button.btn.btn--ghost', { style: 'font-size:.8rem',
    onclick: () => {
      const key = prompt('Wklej swój klucz API Google Cloud Text-to-Speech.\n\n(Google Cloud Console → APIs & Services → Credentials → API key, z włączonym "Cloud Text-to-Speech API").\n\nZostaje tylko na tym urządzeniu.');
      if (!key || !key.trim()) return;
      setGoogleTTSKey(key); location.reload();
    },
  }, [connected ? 'Głos Izabeli: Google (zmień klucz)' : 'Ustaw głos Izabeli (Google TTS)']);
}
