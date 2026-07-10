import { el, navigate } from '../ui.js';
import { store } from '../state.js';
import { auth } from '../services/auth.js';
import { speech } from '../services/speech.js';
import { TRIAL_MINUTES } from '../data/lessons.js';
import { greetingHi, pushLine, minutesWord } from '../data/phrases.js';

// Trzy pasma poziomów — wpływają na temat i trudność lekcji próbnej
const LEVEL_BANDS = [
  { level: 'A1', title: 'Zaczynam', desc: 'Pojedyncze słowa, proste zwroty. Budujemy od zera.' },
  { level: 'B1', title: 'Coś już umiem', desc: 'Dogadam się, ale robię błędy i brakuje mi słów.' },
  { level: 'C1', title: 'Mówię swobodnie', desc: 'Chcę szlifować styl, niuanse i naturalność.' },
];

export function renderLessons(mount) {
  // Pełnoekranowe tło sceny (bez kosmicznego tła apki)
  document.body.classList.add('on-lessons');
  window.addEventListener('hashchange', () => {
    document.body.classList.remove('on-lessons');
    speech.stopSpeaking();
  }, { once: true });

  const screen = el('div.lessons-fs');
  mount.append(screen);
  draw();

  function remainingMinutes() {
    const used = store.get().progress.trialSecondsUsed || 0;
    return Math.max(0, Math.round((TRIAL_MINUTES * 60 - used) / 60));
  }

  function bubbleText(left) {
    const name = (store.get().user?.name || '').trim();
    const used = store.get().progress.trialSecondsUsed || 0;
    if (left <= 0) {
      return { hi: 'No i wyskoczył nam czas próbny!', body: `Ale nie znikaj${name ? ', ' + name : ''}. Niedługo ruszamy z pełnymi lekcjami. Trzymaj wymowę w formie!` };
    }
    if (used > 0) {
      // Powrót z lekcji — Izabela już się witała, podtrzymuje kontakt naturalnie
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
      const hi = pick(['I jak wrażenia?', 'No i jak było?', 'O, wracasz!', `Miło Cię znowu widzieć${name ? ', ' + name : ''}!`, 'No hej, znowu razem!']);
      const opener = pick(['Podobała Ci się nasza rozmowa?', 'Fajnie się gadało, co?', 'Dobrze nam szło ostatnio.']);
      const closer = pick(['Wpadaj śmiało.', 'No to jak, wchodzisz?', 'Ja tu zawsze gotowa do gadania.', 'Klikaj i lecimy dalej.', 'Na spokojnie, bez spiny.', 'Czekam!']);
      return { hi, body: `${opener} Mamy jeszcze około ${left} ${minutesWord(left)} razem do przegadania. ${closer}` };
    }
    // Pierwsze wejście — powitanie składane z klocków, za każdym razem inne
    return {
      hi: greetingHi(name),
      body: `Żebyśmy mogli się poznać i pogadać na luzie, masz u mnie ${TRIAL_MINUTES} ${minutesWord(TRIAL_MINUTES)} lekcji próbnej. Wpadaj kiedy chcesz, możesz zużywać ten czas po kawałku. ${pushLine()}`,
    };
  }

  function draw() {
    const level = store.get().onboarding.level;
    const left = remainingMinutes();
    const bt = bubbleText(left);
    const spoken = `${bt.hi} ${bt.body}`;

    const topRight = el('div.lessons-fs__tools', {}, [
      level ? el('button.btn.btn--ghost', { onclick: () => drawPicker(), title: 'Zmień poziom' }, [`Poziom: ${level} · zmień`]) : null,
      el('button.btn.btn--ghost', { onclick: () => { auth.signOut(); location.hash = '#/'; location.reload(); } }, ['Wyloguj']),
    ]);

    // Dymek Izabeli — mówiony na wejściu, klik = powtórka
    const bubble = el('div.lessons-fs__bubble', {
      title: 'Kliknij, a powtórzę',
      style: 'cursor:pointer',
      onclick: () => speech.speak(spoken, { lang: 'pl-PL' }),
    }, [
      el('div.lessons-fs__bubble-hi', { text: bt.hi }),
      el('p', { style: 'margin:6px 0 0', text: bt.body }),
    ]);

    // JEDEN duży kafelek lekcji próbnej + zegarek z pozostałym czasem pod spodem
    const used = store.get().progress.trialSecondsUsed || 0;
    const frac = Math.min(1, used / (TRIAL_MINUTES * 60));
    const tile = left > 0
      ? el('button.trial-tile', {
          onclick: () => { speech.unlockAudio(); navigate('#/lesson/trial'); },
          'aria-label': 'Lekcja próbna',
        }, [
          el('span.trial-tile__num', { text: `${left}′` }),
          el('span.trial-tile__name', { text: 'Lekcja próbna' }),
        ])
      : el('div.trial-tile.is-locked', {}, [
          el('span.trial-tile__num', { text: '0′' }),
          el('span.trial-tile__name', { text: 'Czas próbny wykorzystany' }),
        ]);
    const clock = el('div.trial-clock', {}, [
      el('div.trial-clock__face', {}, [
        el('i.trial-clock__hand', { style: `transform: rotate(${Math.round(frac * 360)}deg)` }),
        el('i.trial-clock__dot'),
      ]),
      el('div.trial-clock__label', { text: left > 0 ? `zostało ok. ${left} min` : 'pełne lekcje już wkrótce' }),
      // Testowy reset licznika (do usunięcia przed startem produkcyjnym)
      el('button.trial-reset', {
        onclick: () => {
          store.patchKey('progress', { trialSecondsUsed: 0, trialHistory: [], trialChat: [] });
          draw();
        },
      }, ['wyzeruj czas (testy)']),
    ]);

    screen.replaceChildren(
      el('header.lessons-fs__top', {}, [
        el('div.logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
        topRight,
      ]),
      bubble,
      el('div.trial-wrap', {}, [tile, clock]),
    );

    // Izabela mówi to, co w dymku (raz na wejście)
    speech.speak(spoken, { lang: 'pl-PL' });

    // Bez wybranego poziomu — najpierw pytamy, żeby rozmowa nie była nudna ani za trudna
    if (!level) drawPicker();
  }

  function drawPicker() {
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onEsc); };
    const onEsc = (e) => { if (e.key === 'Escape') close(); };
    const overlay = el('div.level-overlay', {
      // klik w tło (poza okienkiem) zamyka
      onclick: (e) => { if (e.target === overlay) close(); },
    }, [
      el('div.level-box', {}, [
        el('button.level-close', { onclick: close, 'aria-label': 'Zamknij', title: 'Zamknij' }, ['X']),
        el('h2.display', { style: 'margin:0 0 4px;color:#14314f', text: 'Na jakim poziomie jest Twój angielski?' }),
        el('p', { style: 'margin:0 0 16px;color:#46688c', text: 'Dopasuję do niego naszą rozmowę. Zawsze możesz to zmienić.' }),
        el('div.level-options', {}, LEVEL_BANDS.map((b) =>
          el('button.level-opt', {
            onclick: () => { store.patchKey('onboarding', { level: b.level }); close(); draw(); },
          }, [
            el('span.level-opt__title', { text: b.title }),
            el('span.level-opt__desc', { text: b.desc }),
          ])
        )),
      ]),
    ]);
    document.addEventListener('keydown', onEsc);
    screen.append(overlay);
  }
}
