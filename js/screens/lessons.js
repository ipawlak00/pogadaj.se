import { el, navigate } from '../ui.js';
import { store } from '../state.js';
import { auth } from '../services/auth.js';
import { speech } from '../services/speech.js';
import { getLessonsForLevel } from '../data/lessons.js';

// Trzy pasma poziomów — każde ma własny zestaw 3 lekcji próbnych
const LEVEL_BANDS = [
  { level: 'A1', title: 'Zaczynam', desc: 'Pojedyncze słowa, proste zwroty. Budujemy od zera.' },
  { level: 'B1', title: 'Coś już umiem', desc: 'Dogadam się, ale robię błędy i brakuje mi słów.' },
  { level: 'C1', title: 'Mówię swobodnie', desc: 'Chcę szlifować styl, niuanse i naturalność.' },
];

export function renderLessons(mount) {
  const st = store.get();
  const done = st.progress.lessonsDone;

  // Pełnoekranowe tło sceny (bez kosmicznego tła apki)
  document.body.classList.add('on-lessons');
  window.addEventListener('hashchange', () => document.body.classList.remove('on-lessons'), { once: true });

  // Info pod biurkiem Izabeli — ukryte; pojawia się DOPIERO po najechaniu na lekcję
  const deskBox = el('div.lessons-fs__desk', { id: 'lesson-info' });

  function showInfo(l, isDone) {
    if (!l) { deskBox.replaceChildren(); deskBox.classList.remove('show'); return; }
    deskBox.replaceChildren(
      el('div.desk-status', { text: isDone ? 'Ukończona — możesz powtórzyć' : 'Darmowa lekcja' }),
      el('h3.display', { style: 'margin:2px 0;color:#14314f', text: `${l.num}. ${l.title}` }),
      el('p', { style: 'margin:0;font-size:.92rem;color:#46688c', text: l.desc }),
      el('div.desk-cta', { text: 'Kliknij, aby wejść' }),
    );
    deskBox.classList.add('show');
  }

  // Kafelek lekcji (lista pionowa po lewej od Izabeli)
  function lessonTile(l, i) {
    const isDone = done.includes(l.id);
    return el(`button.orbit-lesson.orbit-pos-${i + 1}${isDone ? '.is-done' : ''}`, {
      onclick: () => { speech.unlockAudio(); navigate('#/lesson/' + l.id); },
      onmouseenter: () => showInfo(l, isDone),
      onmouseleave: () => showInfo(null),
      onfocus: () => showInfo(l, isDone),
      onblur: () => showInfo(null),
      'aria-label': `Lekcja ${l.num}: ${l.title}`,
    }, [
      el('span.orbit-lesson__num', { text: l.num }),
      el('span.orbit-lesson__name', { text: l.title }),
    ]);
  }

  const screen = el('div.lessons-fs');
  mount.append(screen);
  draw();

  function draw() {
    const level = store.get().onboarding.level;
    const lessons = getLessonsForLevel(level);

    const topRight = el('div.lessons-fs__tools', {}, [
      level ? el('button.btn.btn--ghost', { onclick: () => drawPicker(), title: 'Zmień poziom' }, [`Poziom: ${level} · zmień`]) : null,
      el('button.btn.btn--ghost', { onclick: () => { auth.signOut(); location.hash = '#/'; location.reload(); } }, ['Wyloguj']),
    ]);

    screen.replaceChildren(
      el('header.lessons-fs__top', {}, [
        el('div.logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
        topRight,
      ]),
      el('div.lessons-fs__bubble', {}, [
        el('div.lessons-fs__bubble-hi', { text: 'Siema, z rana jak śmietana!' }),
        el('p', { style: 'margin:6px 0 0', text: 'Na początek, żebyśmy mogli się lepiej poznać i zobaczyć, co razem zdziałamy — mam dla Ciebie 3 próbne lekcje. Wybieraj i lecimy!' }),
      ]),
      ...lessons.map(lessonTile),
      deskBox,
    );

    // Bez wybranego poziomu — najpierw pytamy, żeby lekcje nie były nudne ani za trudne
    if (!level) drawPicker();
  }

  function drawPicker() {
    const overlay = el('div.level-overlay', {}, [
      el('div.level-box', {}, [
        el('h2.display', { style: 'margin:0 0 4px;color:#14314f', text: 'Na jakim poziomie jest Twój angielski?' }),
        el('p', { style: 'margin:0 0 16px;color:#46688c', text: 'Dobiorę do niego Twoje 3 darmowe lekcje. Zawsze możesz to zmienić.' }),
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
