import { el, navigate } from '../ui.js';
import { store } from '../state.js';
import { auth } from '../services/auth.js';
import { speech } from '../services/speech.js';
import { TRIAL_MINUTES } from '../data/lessons.js';
import { greetingHi, minutesWord } from '../data/phrases.js';
import { openFeedback, feedbackCorner, accountButton } from '../ui.js';

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
    // Pierwsze wejście — powitanie składane z klocków, za każdym razem inne.
    // Bez doklejania kolejnego powiedzonka na końcu (greetingHi może już mieć jedno).
    return {
      hi: greetingHi(name),
      body: `Żebyśmy mogli się poznać i pogadać na luzie, masz u mnie ${TRIAL_MINUTES} ${minutesWord(TRIAL_MINUTES)} lekcji próbnej. Wpadaj kiedy chcesz, możesz zużywać ten czas po kawałku.`,
    };
  }

  function draw() {
    const level = store.get().onboarding.level;
    const left = remainingMinutes();

    // Pełna wersja odblokowana → ten ekran już nie obowiązuje
    if (store.get().progress.fullUnlocked) { navigate('#/home'); return; }

    // Czas próbny wykorzystany → scena z kotami i pytanie o dalszą naukę
    if (left <= 0) { drawTrialEnd(); return; }

    const bt = bubbleText(left);
    const spoken = `${bt.hi} ${bt.body}`;

    const topRight = el('div.lessons-fs__tools', {}, [
      // kto jest zalogowany (klik = profil) — żeby konta nigdy się nie myliły
      accountButton(),
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
    // Pasek postępu zamiast zegara — spójny z pełną wersją, bez procentów
    const pct = Math.round(frac * 100);
    const clock = el('div.trial-clock', {}, [
      el('div.time-board', {}, [
        el('div.time-board__time', { text: left > 0 ? `Zostało ${left} min` : 'Czas próbny wykorzystany' }),
        el('div.time-board__bar', {}, [ el('i', { style: `width:${pct}%` }) ]),
      ]),
      // Testowe skróty (do usunięcia przed startem produkcyjnym)
      el('button.trial-reset', {
        onclick: () => {
          store.patchKey('progress', { trialSecondsUsed: 0, trialHistory: [], trialChat: [] });
          draw();
        },
      }, ['wyzeruj czas (testy)']),
      el('button.trial-reset', {
        onclick: () => {
          store.patchKey('progress', { fullUnlocked: true });
          navigate('#/home');
        },
      }, ['przeskocz na pełną wersję (testy)']),
    ]);

    screen.replaceChildren(
      el('header.lessons-fs__top', {}, [
        el('div.logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
        topRight,
      ]),
      el('img.scene-photo', { src: 'assets/scenes/scene-03.jpg', alt: 'Izabela', style: 'object-position:50% 26%' }),
      bubble,
      el('div.trial-wrap', {}, [tile, clock]),
      feedbackCorner('ekran lekcji próbnej'),
    );

    // Izabela mówi to, co w dymku (raz na wejście)
    speech.speak(spoken, { lang: 'pl-PL' });

    // Bez wybranego poziomu — najpierw pytamy, żeby rozmowa nie była nudna ani za trudna
    if (!level) drawPicker();
  }

  // Po wykorzystaniu triala: bliskie, szerokie ujęcie z kotami + decyzja
  function drawTrialEnd() {
    screen.classList.add('lessons-fs--cats');
    const name = (store.get().user?.name || '').trim();
    const ask = `I co myślisz${name ? ', ' + name : ''}? Chcesz się uczyć ze mną dalej?`;

    const bubble = el('div.lessons-fs__bubble.lessons-fs__bubble--end', {}, [
      el('div.lessons-fs__bubble-hi', { id: 'end-hi', text: ask }),
      el('div.row', { id: 'end-actions', style: 'gap:10px;margin-top:12px;flex-wrap:wrap;justify-content:center' }, [
        el('button.btn.btn--primary', { onclick: yes }, ['Oczywiście, że tak!']),
        el('button.btn.btn--sq', { onclick: () => openFeedback('koniec lekcji próbnej') }, ['Wystaw opinię dla autora!']),
      ]),
    ]);

    function yes() {
      const line = 'Wiedziałam! W takim razie rozgość się na moim statku. Mam nadzieję, że zostaniesz ze mną na dłużej.';
      document.getElementById('end-hi').textContent = line;
      speech.speak('Wiedziałam!... ' + line.slice(11), { lang: 'pl-PL' });
      const actions = document.getElementById('end-actions');
      actions.replaceChildren(
        el('button.btn.btn--primary.btn--lg', {
          onclick: () => { store.patchKey('progress', { fullUnlocked: true }); navigate('#/home'); },
        }, ['Przejdź na pełną wersję']),
      );
    }

    screen.replaceChildren(
      el('header.lessons-fs__top', {}, [
        el('div.logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
        el('div.lessons-fs__tools', {}, [
          accountButton(),
          el('button.btn.btn--ghost', { onclick: () => { auth.signOut(); location.hash = '#/'; location.reload(); } }, ['Wyloguj']),
        ]),
      ]),
      bubble,
      feedbackCorner('ekran po lekcji próbnej'),
    );
    speech.speak(ask, { lang: 'pl-PL' });
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
