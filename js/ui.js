// =============================================================
//  UI, drobne helpery DOM (bez frameworka)
// =============================================================

import { CONFIG } from './config.js';
import { store } from './state.js';
import { auth, passwordProblem } from './services/auth.js';
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
  const st = store.get();
  const area = el('textarea.feedback-text', {
    placeholder: 'Napisz, co myślisz o aplikacji i lekcji. Coś nie działało? Masz pomysł, co poprawić albo naprawić? Pisz śmiało, czytam wszystko.',
    maxlength: '4000',
  });
  // Podpis OPCJONALNY, imię albo ksywka (można zostawić puste)
  const signIn = el('input.feedback-sign', {
    type: 'text', maxlength: '40', value: st.user?.name || '',
    placeholder: 'Imię lub ksywka (opcjonalnie)',
  });
  const sendBtn = el('button.btn.btn--sq.btn--block', { onclick: send }, ['Wyślij do Izabeli']);
  const overlay = el('div.level-overlay', {
    onclick: (e) => { if (e.target === overlay) overlay.remove(); },
  }, [
    el('div.level-box.feedback-box', {}, [
      el('button.level-close', { onclick: () => overlay.remove(), 'aria-label': 'Zamknij' }, ['X']),
      el('h2.display', { style: 'margin:0 0 4px;color:#14314f', text: 'Zostaw opinię Izabeli' }),
      el('p', { style: 'margin:0 0 12px;color:#46688c', text: 'Każda uwaga trafia prosto do autorki. Dzięki.' }),
      area,
      signIn,
      sendBtn,
    ]),
  ]);

  async function send() {
    const text = area.value.trim();
    if (!text) { toast('Napisz chociaż słowo, mordeczko', 'error'); return; }
    sendBtn.disabled = true; sendBtn.textContent = 'Wysyłam…';
    try {
      const base = (CONFIG.GEMINI.proxyBase || '').replace(/\/$/, '');
      const res = await fetch(base + '/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, page: page || '', email: st.user?.email || '', name: signIn.value.trim() }),
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

// ---------- Profil użytkownika ----------
// Przycisk z imieniem (taki sam jak sąsiednie) otwiera okno profilu:
// zmiana imienia, adresu email i hasła.
export function accountButton() {
  const u = store.get().user;
  if (!u) return el('span');
  return el('button.btn.btn--ghost', { title: 'Twój profil', onclick: openProfile },
    [u.name || u.email || 'Profil']);
}

export function openProfile() {
  const u = store.get().user || {};
  const nameIn = el('input', { type: 'text', value: u.name || '', placeholder: 'Twoje imię' });
  const emailIn = el('input', { type: 'email', value: u.email || '', placeholder: 'twój@email.com' });
  const curPass = el('input', { type: 'password', placeholder: 'Obecne hasło', autocomplete: 'current-password' });
  const newPass = el('input', { type: 'password', placeholder: 'Nowe hasło', autocomplete: 'new-password' });
  const saveBtn = el('button.btn.btn--primary.btn--block', { onclick: save }, ['Zapisz zmiany']);

  const overlay = el('div.level-overlay', {
    onclick: (e) => { if (e.target === overlay) overlay.remove(); },
  }, [
    el('div.level-box.profile-box', {}, [
      el('button.level-close', { onclick: () => overlay.remove(), 'aria-label': 'Zamknij' }, ['X']),
      el('h2.display', { style: 'margin:0 0 4px;color:#14314f', text: 'Twój profil' }),
      el('p', { style: 'margin:0 0 14px;color:#46688c', text: 'Zmień, co potrzebujesz, i zapisz.' }),
      el('div.field', {}, [ el('label', { text: 'Imię' }), nameIn ]),
      el('div.field', {}, [ el('label', { text: 'Email' }), emailIn ]),
      el('div', { style: 'border-top:1px solid #dce9f5;margin:4px 0 14px' }),
      el('p', { style: 'margin:0 0 10px;color:#46688c;font-size:.85rem', text: 'Zmiana hasła (pomiń, jeśli zostaje stare)' }),
      el('div.field', {}, [ el('label', { text: 'Obecne hasło' }), curPass ]),
      el('div.field', {}, [ el('label', { text: 'Nowe hasło' }), newPass ]),
      saveBtn,
    ]),
  ]);

  async function save() {
    const newName = nameIn.value.trim();
    const newEmail = emailIn.value.trim().toLowerCase();
    saveBtn.disabled = true; saveBtn.textContent = 'Zapisuję…';
    try {
      // kolejność: imię → hasło → email (zmiana emaila wymienia token sesji)
      if (newName && newName !== (u.name || '')) await auth.setName(newName);
      if (newPass.value) {
        if (!curPass.value) throw new Error('Podaj obecne hasło, żeby ustawić nowe.');
        const pp = passwordProblem(newPass.value);
        if (pp) throw new Error(pp);
        await auth.setPassword(curPass.value, newPass.value);
      }
      if (newEmail && newEmail !== (u.email || '')) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) throw new Error('Podaj poprawny adres email.');
        await auth.setEmail(newEmail);
      }
      overlay.remove();
      toast('Profil zapisany.');
      window.dispatchEvent(new HashChangeEvent('hashchange'));   // odśwież imię na przycisku
    } catch (e) {
      saveBtn.disabled = false; saveBtn.textContent = 'Zapisz zmiany';
      toast(e.message || 'Nie udało się zapisać profilu.', 'error');
    }
  }

  document.body.append(overlay);
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

// Nawigacja hashem. Gdy hash się NIE zmienia (np. logowanie na '#/'),
// przeglądarka nie wyśle hashchange, wysyłamy go sami, żeby router
// przerysował ekran (inaczej „Zaloguj" nic nie robiło).
export const navigate = (hash) => {
  if (location.hash === hash || (!location.hash && hash === '#/')) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
};

// Przycisk podłączenia prawdziwego AI (Gemini). Klucz wpisuje użytkownik u siebie
//, trafia tylko do localStorage tego urządzenia, nigdy do repo.
export function aiConnectButton() {
  const connected = hasGeminiKey();
  return el('button.btn.btn--ghost', { style: 'font-size:.8rem',
    onclick: () => {
      const k = prompt('Wklej swój klucz Gemini API (z aistudio.google.com).\n\nKlucz zostaje TYLKO na tym urządzeniu, nie wysyłamy go nigdzie poza Google ani nie zapisujemy w kodzie.');
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
