// =============================================================
//  UI — drobne helpery DOM (bez frameworka)
// =============================================================

import { setGeminiKey, hasGeminiKey } from './services/ai.js';

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
  }, [connected ? '🟢 Izabela AI: połączona (zmień klucz)' : '🔌 Połącz Izabelę z prawdziwym AI']);
}
