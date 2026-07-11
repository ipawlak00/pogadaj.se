import { el, navigate, feedbackCorner, accountButton } from '../ui.js';
import { store } from '../state.js';
import { auth } from '../services/auth.js';
import { speech } from '../services/speech.js';
import { FULL_MONTH_MINUTES, HOME_SCENES } from '../data/lessons.js';
import { minutesWord } from '../data/phrases.js';

// PEŁNA WERSJA — tło (Izabela z kotami) zmienia się przy KAŻDYM wejściu.
// Przyciski i dymek są ustawiane per-scena tak, by nie zasłaniać twarzy ani kotów.
export function renderHome(mount) {
  document.body.classList.add('on-lessons');
  window.addEventListener('hashchange', () => {
    document.body.classList.remove('on-lessons');
  }, { once: true });

  const screen = el('div.home-fs');
  mount.append(screen);

  // miesięczny reset budżetu
  const mk = new Date().toISOString().slice(0, 7);
  if (store.get().progress.fullMonth !== mk) {
    store.patchKey('progress', { fullMonth: mk, fullSecondsUsed: 0 });
  }

  const usedSec = store.get().progress.fullSecondsUsed || 0;
  const totalSec = FULL_MONTH_MINUTES * 60;
  const leftSec = Math.max(0, totalSec - usedSec);
  // floor, nie round — inaczej 14:59:30 wyświetlało się jako „14 h 60 min"
  const leftH = Math.floor(leftSec / 3600);
  const leftM = Math.floor((leftSec % 3600) / 60);
  const usedPct = Math.min(100, Math.round((usedSec / totalSec) * 100));

  const name = (store.get().user?.name || '').trim();
  const hasFullSession = (store.get().progress.fullHistory || []).length > 1;

  // Wybór sceny: rotujemy przy każdym wejściu (indeks trzymany w store),
  // więc obraz zmienia się za każdym razem, gdy wchodzisz na ekran.
  const rot = (store.get().progress.homeSceneIdx || 0) % HOME_SCENES.length;
  store.patchKey('progress', { homeSceneIdx: (rot + 1) % HOME_SCENES.length });
  const layout = HOME_SCENES[rot];
  screen.style.backgroundImage = `url('${layout.src}')`;

  // Tablica z czasem (kompaktowa, w lewym górnym rogu — bezpieczna strefa)
  const board = el('div.home-board', {}, [
    el('div.home-board__title', { text: 'Twój czas w tym miesiącu' }),
    el('div.home-board__time', { text: `${leftH} h ${leftM} min` }),
    el('div.home-board__sub', { text: `z ${FULL_MONTH_MINUTES / 60} godzin` }),
    el('div.home-board__bar', {}, [ el('i', { style: `width:${usedPct}%` }) ]),
    el('div.home-board__pct', { text: `wykorzystane: ${usedPct}%` }),
  ]);

  // Historia + akcje w JEDNEJ kolumnie, ustawianej per-scena
  const controls = el('div.home-controls', { style: layout.controls }, [
    el('button.btn.btn--sq', { onclick: () => navigate('#/history') }, ['Sprawdź historię swoich lekcji']),
    hasFullSession ? el('button.btn.btn--sq', {
      onclick: () => { speech.unlockAudio(); navigate('#/lesson/full'); },
    }, ['Kontynuuj lekcję']) : null,
    el('button.btn.btn--primary', {
      onclick: () => {
        store.patchKey('progress', { fullHistory: [], fullChat: [], currentFullId: null });
        speech.unlockAudio();
        navigate('#/lesson/full');
      },
    }, ['Zacznij nową lekcję']),
  ]);

  // Dymek z tym, co mówi Izabela (klik = powtórka) — w bezpiecznej strefie sceny
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const hi = pick([
    `Witaj w pełnej wersji${name ? ', ' + name : ''}!`,
    'No i jesteśmy u siebie!',
    'Rozgość się, to nasz statek!',
  ]);
  const spoken = `${hi} Masz jeszcze ${leftH} godzin i ${leftM} ${minutesWord(leftM)} rozmów w tym miesiącu. Klikaj i gadamy!`;
  const bubble = el('div.scene-bubble', {
    style: layout.bubble, title: 'Kliknij, a powtórzę',
    onclick: () => speech.speak(spoken, { lang: 'pl-PL' }),
  }, [
    el('div.scene-bubble__who', { text: 'Izabela' }),
    el('div.scene-bubble__hi', { text: hi }),
    el('p', { style: 'margin:4px 0 0', text: `Masz jeszcze ${leftH} h ${leftM} min rozmów w tym miesiącu. Klikaj i gadamy!` }),
  ]);

  screen.replaceChildren(
    el('header.lessons-fs__top', {}, [
      el('div.logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
      el('div.lessons-fs__tools', {}, [
        accountButton(),
        el('button.btn.btn--ghost', { onclick: () => { auth.signOut(); location.hash = '#/'; location.reload(); } }, ['Wyloguj']),
      ]),
    ]),
    board,
    bubble,
    controls,
    feedbackCorner('pełna wersja'),
  );

  speech.speak(spoken, { lang: 'pl-PL' });
}
