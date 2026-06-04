// =============================================================
//  pogadaj.se — punkt wejścia + router (hash-based)
// =============================================================

import { CONFIG, isDev } from './config.js';
import { clear } from './ui.js';
import { store } from './state.js';

import { renderWelcome } from './screens/welcome.js';
import { renderOnboarding } from './screens/onboarding.js';
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
    case '#/phonetic':
      if (!st.onboarding.completed) return redirect('#/onboarding');
      return renderPhonetic(appEl);
    case '#/lessons': return guarded(st, () => renderLessons(appEl));
    case '#/':
    default:
      // Jeśli użytkownik już przeszedł onboarding — wpuść od razu do lekcji
      if (st.onboarding.completed && st.phonetic.completed) return renderLessons(appEl);
      return renderWelcome(appEl);
  }
}

// Guard: do lekcji wpuszczamy dopiero po onboardingu i paszporcie
function guarded(st, render) {
  if (!st.onboarding.completed) return redirect('#/onboarding');
  if (!st.phonetic.completed) return redirect('#/phonetic');
  return render();
}

function redirect(hash) { location.hash = hash; /* hashchange wywoła render */ }

function render() {
  clear(appEl);
  window.scrollTo(0, 0);
  resolve();
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
render();

// PWA: rejestracja service workera (poza dev)
if ('serviceWorker' in navigator && !isDev()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

if (isDev()) console.info(`%c${CONFIG.appName} v${CONFIG.version}`, 'color:#5b8cff', `· AI:${CONFIG.AI_PROVIDER} · Auth:${CONFIG.AUTH_PROVIDER}`);
