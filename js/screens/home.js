import { el, navigate, openFeedback, feedbackCorner, accountButton } from '../ui.js';
import { store } from '../state.js';
import { auth } from '../services/auth.js';
import { speech } from '../services/speech.js';
import { FULL_MONTH_MINUTES, HOME_SCENES } from '../data/lessons.js';
import { minutesWord } from '../data/phrases.js';

// PEŁNA WERSJA — tła przewijają się płynnie (Izabela z kotami itd.),
// na wierzchu panel z dostępnym czasem w tym miesiącu (domyślnie 15 h).
export function renderHome(mount) {
  document.body.classList.add('on-lessons');
  window.addEventListener('hashchange', () => {
    document.body.classList.remove('on-lessons');
    speech.stopSpeaking();
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

  // Tablica z czasem (nakładka na tablicę ze sceny)
  const board = el('div.home-board', {}, [
    el('div.home-board__title', { text: 'Twój czas w tym miesiącu' }),
    el('div.home-board__time', { text: `${leftH} h ${leftM} min` }),
    el('div.home-board__sub', { text: `z ${FULL_MONTH_MINUTES / 60} godzin` }),
    el('div.home-board__bar', {}, [ el('i', { style: `width:${usedPct}%` }) ]),
    el('div.home-board__pct', { text: `wykorzystane: ${usedPct}%` }),
  ]);

  // Historia lekcji — przycisk na prawo od Izabeli
  const historyBtn = el('button.btn.btn--sq.home-history-btn', {
    onclick: () => navigate('#/history'),
  }, ['Sprawdź historię swoich lekcji']);

  // Pod Izabelą: kontynuacja (jeśli jest niedokończona sesja) + nowa lekcja
  const actions = el('div.home-actions', {}, [
    hasFullSession ? el('button.btn.btn--sq', {
      onclick: () => { speech.unlockAudio(); navigate('#/lesson/full'); },
    }, ['Kontynuuj lekcję']) : null,
    el('button.btn.btn--primary', {
      onclick: () => {
        // nowa lekcja = nowa sesja: czyścimy pamięć rozmowy i identyfikator
        store.patchKey('progress', { fullHistory: [], fullChat: [], currentFullId: null });
        speech.unlockAudio();
        navigate('#/lesson/full');
      },
    }, ['Zacznij nową lekcję']),
  ]);

  // Przewijane tła: dwie warstwy przenikają się co kilkanaście sekund.
  // Brakujący plik (np. scene-17 przed wgraniem) jest po prostu pomijany.
  const bgA = el('div.home-bg');
  const bgB = el('div.home-bg');
  let bgCur = bgA, bgNext = bgB, bgIdx = 0;
  function showBg(k, attemptsLeft) {
    if (attemptsLeft <= 0) return;
    const src = HOME_SCENES[k % HOME_SCENES.length];
    const im = new Image();
    im.onload = () => {
      bgNext.style.backgroundImage = `url('${src}')`;
      bgNext.classList.add('show');
      bgCur.classList.remove('show');
      [bgCur, bgNext] = [bgNext, bgCur];
      bgIdx = k + 1;
    };
    im.onerror = () => showBg(k + 1, attemptsLeft - 1);
    im.src = src;
  }
  showBg(0, HOME_SCENES.length);
  const bgTimer = setInterval(() => showBg(bgIdx, HOME_SCENES.length), 14000);
  window.addEventListener('hashchange', () => clearInterval(bgTimer), { once: true });

  screen.replaceChildren(
    bgA,
    bgB,
    el('header.lessons-fs__top', {}, [
      el('div.logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
      el('div.lessons-fs__tools', {}, [
        accountButton(),
        el('button.btn.btn--ghost', { onclick: () => { auth.signOut(); location.hash = '#/'; location.reload(); } }, ['Wyloguj']),
      ]),
    ]),
    board,
    historyBtn,
    actions,
    feedbackCorner('pełna wersja'),
  );

  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const hi = pick([
    `Witaj w pełnej wersji${name ? ', ' + name : ''}!`,
    'No i jesteśmy u siebie!',
    'Rozgość się, to nasz statek!',
  ]);
  speech.speak(`${hi} Masz jeszcze ${leftH} godzin i ${leftM} ${minutesWord(leftM)} rozmów w tym miesiącu. Klikaj i gadamy!`, { lang: 'pl-PL' });
}
