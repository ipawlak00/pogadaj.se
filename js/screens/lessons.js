import { el, topbar, navigate, aiConnectButton, voiceConnectButton } from '../ui.js';
import { store } from '../state.js';
import { auth } from '../services/auth.js';
import { LESSONS } from '../data/lessons.js';

export function renderLessons(mount) {
  const st = store.get();
  const done = st.progress.lessonsDone;

  const userChip = el('div.row', {}, [
    el('span.pill', { text: `${st.user?.name || 'Gość'}` }),
    el('button.btn.btn--ghost', { onclick: () => { auth.signOut(); location.hash = '#/'; location.reload(); } }, ['Wyloguj']),
  ]);

  // Info pod biurkiem Izabeli (pojawia się po najechaniu na lekcję)
  const deskHint = () => [el('div.desk-hint', { text: 'Najedź na lekcję, aby zobaczyć szczegóły' })];
  const deskBox = el('div.lessons-hero__desk', { id: 'lesson-info' }, deskHint());

  function showInfo(l, isDone) {
    if (!l) { deskBox.replaceChildren(...deskHint()); deskBox.classList.remove('show'); return; }
    deskBox.replaceChildren(
      el('div.desk-status', { text: isDone ? 'Ukończona — możesz powtórzyć' : 'Darmowa lekcja' }),
      el('h3.display', { style: 'margin:2px 0', text: `${l.num}. ${l.title}` }),
      el('p.muted', { style: 'margin:0;font-size:.92rem', text: l.desc }),
      el('div.desk-cta', { text: 'Kliknij, aby wejść →' }),
    );
    deskBox.classList.add('show');
  }

  // Przycisk lekcji na orbicie wokół Izabeli
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

  const hero = el('div.lessons-hero', {}, [
    el('div.lessons-hero__ring'),
    el('img.lessons-hero__iza', {
      src: 'assets/izabela/izabela-lesson.png', alt: 'Izabela',
      onerror: function () { this.replaceWith(el('div.lessons-hero__iza-fallback', { text: 'Izabela' })); },
    }),
    ...LESSONS.map(orbitBtn),
    deskBox,
  ]);

  mount.append(
    topbar(userChip),
    el('div.lessons-screen.fade-in', {}, [
      el('div.lessons-head', {}, [
        el('h1.display.lessons-title', { text: 'Sprawdź jak łatwo możemy ze sobą pogadać!' }),
        el('p.lessons-sub', { text: '3 lekcje na rozgrzewkę' }),
      ]),
      hero,
      el('div.row', { style: 'justify-content:center;gap:10px;flex-wrap:wrap;margin-top:18px' }, [aiConnectButton(), voiceConnectButton()]),
      analystSummary(st.analyst),
    ])
  );

  function analystSummary(mistakes) {
    if (!mistakes.length) return el('span');
    return el('div.card', { style: 'margin-top:8px' }, [
      el('h3.display', { style: 'margin:0 0 10px', text: 'Twój Analityk — zebrane błędy' }),
      ...mistakes.slice(-6).reverse().map((m) => el('div.mistake', {}, [
        el('div', {}, [el('span.bad', { text: m.bad }), ' → ', el('span.good', { text: m.good })]),
        el('div.note', { text: m.note }),
      ])),
    ]);
  }
}
