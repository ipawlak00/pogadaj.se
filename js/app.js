// =============================================================
//  pogadaj.se, punkt wejścia + router (hash-based)
// =============================================================

import { CONFIG, isDev } from './config.js';
import { clear } from './ui.js';
import { store } from './state.js';
import { speech } from './services/speech.js';
import { auth } from './services/auth.js';

import { renderWelcome } from './screens/welcome.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderIntro } from './screens/intro.js';
import { renderPhonetic } from './screens/phonetic.js';
import { renderHome } from './screens/home.js';
import { renderHistory } from './screens/history.js';
import { renderLessons } from './screens/lessons.js';
import { renderConversation } from './screens/conversation.js';
import { renderReset } from './screens/reset.js';
import { renderLanding } from './screens/landing.js';

const appEl = document.getElementById('app');

// Definicje tras + guardy przepływu onboardingu
function resolve() {
  const hash = location.hash || '#/';
  const st = store.get();

  // Reset hasła z linku w mailu (#/reset?e=...&t=...), dostępny bez logowania
  if (hash.startsWith('#/reset')) return renderReset(appEl);

  // /lesson/:id
  const lessonMatch = hash.match(/^#\/lesson\/(.+)$/);
  if (lessonMatch) return guarded(st, () => renderConversation(appEl, lessonMatch[1]));

  switch (hash) {
    // Ekran logowania/rejestracji (z landingu). Zalogowanych odsyłamy dalej.
    case '#/login':
    case '#/register':
      if (st.user) return redirect('#/');
      return renderWelcome(appEl);
    case '#/onboarding': return renderOnboarding(appEl);
    case '#/intro':
      if (!st.user) return redirect('#/');       // film dopiero PO założeniu konta
      return renderIntro(appEl);
    case '#/phonetic':
      if (!st.user) return redirect('#/');
      if (!st.onboarding.completed) return redirect('#/onboarding');
      return renderPhonetic(appEl);
    // Ekran przekierowuje na główny (pełny) widok.
    case '#/lessons': return redirect('#/home');
    case '#/home':
      return guarded(st, () => renderHome(appEl));
    case '#/history':
      return guarded(st, () => renderHistory(appEl));
    case '#/':
    default:
      // Kolejność: strona główna → konto → film → cel/poziom → paszport → lekcje
      if (!st.user) return renderLanding(appEl);
      if (!st.progress.introSeen) return redirect('#/intro');
      if (!st.onboarding.completed) return redirect('#/onboarding');
      if (!st.phonetic.completed) return redirect('#/phonetic');
      // Trial schowany, wszyscy lądują na statku (pełna wersja).
      return renderHome(appEl);
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
  if (hash === '#/login' || hash === '#/register') return 'welcome';
  return st.user ? 'lessons' : 'welcome';   // '#/' (landing) też kosmos
}

function render() {
  // Wyciszamy mowę POPRZEDNIEGO ekranu tutaj, zanim nowy ekran zacznie mówić.
  // (Dawniej robiły to ekrany w swoim cleanupie hashchange, ale ten odpalał się
  // PO renderze nowego ekranu i ucinał jego pierwszą kwestię, stąd cisza.)
  speech.stopSpeaking();
  clear(appEl);
  window.scrollTo(0, 0);
  const rk = routeKey(location.hash || '#/', store.get());
  document.body.dataset.route = rk;
  // Klasę pełnoekranowych scen (home/historia) trzyma ROUTER, inaczej cleanup
  // poprzedniego ekranu ściągał ją PO dodaniu przez nowy ekran (tło przeciekało).
  document.body.classList.toggle('on-lessons', rk === 'lessons');
  resolve();
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
render();

// Auto-zapis postępów (poziom, historia, czas) do bazy per konto.
auth.startStateSync();

// PWA: na czas aktywnego developmentu CACHE WYŁĄCZONY.
// Wyrejestrowujemy ewentualny stary service worker i czyścimy cache,
// żeby zmiany były zawsze widoczne (inaczej Pages serwuje starą wersję).
// TODO: po ustabilizowaniu apki włączyć z powrotem rejestrację SW (PWA/offline).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  if ('caches' in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
}

if (isDev()) console.info(`%c${CONFIG.appName} v${CONFIG.version}`, 'color:#5b8cff', `· AI:${CONFIG.AI_PROVIDER} · Auth:${CONFIG.AUTH_PROVIDER}`);
