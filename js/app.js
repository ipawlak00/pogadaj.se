// =============================================================
//  pogadaj.se — punkt wejścia + router (hash-based)
// =============================================================

import { CONFIG, isDev } from './config.js';
import { clear } from './ui.js';
import { store } from './state.js';

import { renderWelcome } from './screens/welcome.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderIntro } from './screens/intro.js';
import { renderPhonetic } from './screens/phonetic.js';
import { renderLessons } from './screens/lessons.js';
import { renderConversation } from './screens/conversation.js';

const appEl = document.getElementById('app');

// Definicje tras + guardy przepływu onboardingu
function resolve() {
  const hash = location.hash || '#/';
  const st = store.get();

  // /lesson/:id
  const lessonMatch = hash.match(/^#\/lesson\/(.+)$/);
  if (lessonMatch) return guarded(st, () => renderConversation(appEl, lessonMatch[1]));

  switch (hash) {
    case '#/onboarding': return renderOnboarding(appEl);
    case '#/intro':
      if (!st.onboarding.completed) return redirect('#/onboarding');
      return renderIntro(appEl);
    case '#/phonetic':
      if (!st.onboarding.completed) return redirect('#/onboarding');
      return renderPhonetic(appEl);
    case '#/lessons': return guarded(st, () => renderLessons(appEl));
    case '#/':
    default:
      // Niezalogowany → ekran logowania. Zalogowany → dalej wg etapu.
      if (!st.user) return renderWelcome(appEl);
      if (!st.onboarding.completed) return redirect('#/onboarding');
      if (!st.phonetic.completed) return redirect('#/phonetic');
      return renderLessons(appEl);
  }
}

// Guard: wymaga zalogowania + ukończonego onboardingu i paszportu
function guarded(st, render) {
  if (!st.user) return redirect('#/');
  if (!st.onboarding.completed) return redirect('#/onboarding');
  if (!st.phonetic.completed) return redirect('#/phonetic');
  return render();
}

function redirect(hash) { location.hash = hash; /* hashchange wywoła render */ }

// Motyw zależny od ekranu: planety + pomarańcz TYLKO na logowaniu,
// reszta apki = pokład statku (chłodny błękit). Steruje tym data-route na <body>.
function routeKey(hash, st) {
  if (/^#\/lesson\//.test(hash)) return 'lesson';
  if (hash === '#/onboarding') return 'onboarding';
  if (hash === '#/intro') return 'intro';
  if (hash === '#/phonetic') return 'phonetic';
  if (hash === '#/lessons') return 'lessons';
  return st.user ? 'lessons' : 'welcome';   // '#/' zależnie od logowania
}

function render() {
  clear(appEl);
  window.scrollTo(0, 0);
  document.body.dataset.route = routeKey(location.hash || '#/', store.get());
  resolve();
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
render();

// PWA: na czas aktywnego developmentu CACHE WYŁĄCZONY.
// Wyrejestrowujemy ewentualny stary service worker i czyścimy cache,
// żeby zmiany były zawsze widoczne (inaczej Pages serwuje starą wersję).
// TODO: po ustabilizowaniu apki włączyć z powrotem rejestrację SW (PWA/offline).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  if ('caches' in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
}

if (isDev()) console.info(`%c${CONFIG.appName} v${CONFIG.version}`, 'color:#5b8cff', `· AI:${CONFIG.AI_PROVIDER} · Auth:${CONFIG.AUTH_PROVIDER}`);
