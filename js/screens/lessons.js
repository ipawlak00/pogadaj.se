import { el, navigate, aiConnectButton, voiceConnectButton } from '../ui.js';
import { store } from '../state.js';
import { auth } from '../services/auth.js';
import { LESSONS } from '../data/lessons.js';

export function renderLessons(mount) {
  const st = store.get();
  const done = st.progress.lessonsDone;

  // Pełnoekranowe tło sceny (bez kosmicznego tła apki)
  document.body.classList.add('on-lessons');
  window.addEventListener('hashchange', () => document.body.classList.remove('on-lessons'), { once: true });

  // Info pod biurkiem Izabeli (pojawia się po najechaniu na lekcję)
  const deskHint = () => [el('div.desk-hint', { text: 'Najedź na lekcję, aby zobaczyć szczegóły' })];
  const deskBox = el('div.lessons-fs__desk', { id: 'lesson-info' }, deskHint());

  function showInfo(l, isDone) {
    if (!l) { deskBox.replaceChildren(...deskHint()); deskBox.classList.remove('show'); return; }
    deskBox.replaceChildren(
      el('div.desk-status', { text: isDone ? 'Ukończona — możesz powtórzyć' : 'Darmowa lekcja' }),
      el('h3.display', { style: 'margin:2px 0', text: `${l.num}. ${l.title}` }),
      el('p', { style: 'margin:0;font-size:.92rem;color:#dfe8ff', text: l.desc }),
      el('div.desk-cta', { text: 'Kliknij, aby wejść →' }),
    );
    deskBox.classList.add('show');
  }

  // Przycisk lekcji rozłożony na orbicie wokół Izabeli
  function orbitBtn(l, i) {
    const isDone = done.includes(l.id);
    return el(`button.orbit-lesson.orbit-pos-${i + 1}${isDone ? '.is-done' : ''}`, {
      onclick: () => navigate('#/lesson/' + l.id),
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

  const topRight = el('div.lessons-fs__tools', {}, [
    aiConnectButton(),
    voiceConnectButton(),
    el('button.btn.btn--ghost', { onclick: () => { auth.signOut(); location.hash = '#/'; location.reload(); } }, ['Wyloguj']),
  ]);

  const screen = el('div.lessons-fs', {}, [
    el('header.lessons-fs__top', {}, [
      el('div.logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
      topRight,
    ]),
    el('div.lessons-fs__head', {}, [
      el('h1.lessons-title', { text: 'Sprawdź jak łatwo możemy ze sobą pogadać!' }),
      el('p.lessons-sub', { text: '3 lekcje na rozgrzewkę' }),
    ]),
    ...LESSONS.map(orbitBtn),
    deskBox,
  ]);

  mount.append(screen);
}
