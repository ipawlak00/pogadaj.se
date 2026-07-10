import { el, navigate } from '../ui.js';
import { store } from '../state.js';
import { auth } from '../services/auth.js';
import { speech } from '../services/speech.js';
import { TRIAL_MINUTES } from '../data/lessons.js';
import { greetingHi, pushLine } from '../data/phrases.js';

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
    if (left <= 0) {
      return { hi: 'No i wyskoczył nam czas próbny!', body: `Ale nie znikaj${name ? ', ' + name : ''} — niedługo ruszamy z pełnymi lekcjami. Trzymaj wymowę w formie!` };
    }
    // Powitanie składane z klocków — za każdym wejściem inne
    return {
      hi: greetingHi(name),
      body: `Żebyśmy mogli się poznać i pogadać na luzie, masz u mnie ${TRIAL_MINUTES} minut lekcji próbnej. Wpadaj kiedy chcesz — możesz zużywać ten czas po kawałku. ${pushLine()}`,
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

    // JEDEN kafelek lekcji próbnej z licznikiem czasu
    const tile = left > 0
      ? el('button.orbit-lesson.orbit-pos-2', {
          onclick: () => { speech.unlockAudio(); navigate('#/lesson/trial'); },
          'aria-label': 'Lekcja próbna',
        }, [
          el('span.orbit-lesson__num', { text: `${left}′` }),
          el('span.orbit-lesson__name', { text: 'Lekcja próbna' }),
          el('span.orbit-lesson__sub', { text: `zostało ok. ${left} min` }),
        ])
      : el('div.orbit-lesson.orbit-pos-2.is-locked', {}, [
          el('span.orbit-lesson__num', { text: '0′' }),
          el('span.orbit-lesson__name', { text: 'Czas próbny wykorzystany' }),
          el('span.orbit-lesson__sub', { text: 'pełne lekcje już wkrótce' }),
        ]);

    screen.replaceChildren(
      el('header.lessons-fs__top', {}, [
        el('div.logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
        topRight,
      ]),
      bubble,
      tile,
    );

    // Izabela mówi to, co w dymku (raz na wejście)
    speech.speak(spoken, { lang: 'pl-PL' });

    // Bez wybranego poziomu — najpierw pytamy, żeby rozmowa nie była nudna ani za trudna
    if (!level) drawPicker();
  }

  function drawPicker() {
    const overlay = el('div.level-overlay', {}, [
      el('div.level-box', {}, [
        el('h2.display', { style: 'margin:0 0 4px;color:#14314f', text: 'Na jakim poziomie jest Twój angielski?' }),
        el('p', { style: 'margin:0 0 16px;color:#46688c', text: 'Dopasuję do niego naszą rozmowę. Zawsze możesz to zmienić.' }),
        el('div.level-options', {}, LEVEL_BANDS.map((b) =>
          el('button.level-opt', {
            onclick: () => { store.patchKey('onboarding', { level: b.level }); overlay.remove(); draw(); },
          }, [
            el('span.level-opt__title', { text: b.title }),
            el('span.level-opt__desc', { text: b.desc }),
          ])
        )),
      ]),
    ]);
    screen.append(overlay);
  }
}
