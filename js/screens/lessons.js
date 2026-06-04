import { el, topbar, navigate, toast } from '../ui.js';
import { store } from '../state.js';
import { auth } from '../services/auth.js';
import { LESSONS } from '../data/lessons.js';
import { izabela } from '../components/izabela.js';

export function renderLessons(mount) {
  const st = store.get();
  const done = st.progress.lessonsDone;

  const userChip = el('div.row', {}, [
    el('span.pill', { text: `👋 ${st.user?.name || 'Gość'}` }),
    el('button.btn.btn--ghost', { onclick: () => { auth.signOut(); location.hash = '#/'; location.reload(); } }, ['Wyloguj']),
  ]);

  mount.append(
    topbar(userChip),
    el('div.stack.fade-in', {}, [
      el('div.row', { style: 'gap:14px' }, [
        izabela({ mood: 'happy', size: 56 }),
        el('div', {}, [
          el('h1.display', { style: 'margin:0', text: 'Twoje darmowe lekcje' }),
          el('p.muted', { style: 'margin:6px 0 0', text: '3 lekcje na rozgrzewkę. Mów śmiało — Izabela poprawia z uśmiechem.' }),
        ]),
      ]),
      el('div.lesson-grid', {}, LESSONS.map((l, i) => lessonCard(l, i, done))),
      analystSummary(st.analyst),
    ])
  );

  function lessonCard(l, i, done) {
    const isDone = done.includes(l.id);
    // Odblokowane: pierwsza zawsze; kolejna gdy poprzednia zrobiona
    const prevDone = i === 0 || done.includes(LESSONS[i - 1].id);
    const locked = !prevDone;
    const badge = isDone
      ? el('span.badge.badge--done', { text: '✓ ukończona' })
      : locked
        ? el('span.badge.badge--locked', { text: '🔒 zablokowana' })
        : el('span.badge.badge--free', { text: 'darmowa' });

    return el(`div.card.lesson-card${locked ? '.locked' : ''}`, {
      onclick: () => { if (locked) return toast('Najpierw ukończ poprzednią lekcję 😉'); navigate('#/lesson/' + l.id); },
      style: locked ? '' : 'cursor:pointer',
    }, [
      el('div.num', { text: l.num }),
      el('div', { style: 'font-size:1.8rem', text: l.emoji }),
      el('h3.display', { style: 'margin:6px 0', text: l.title }),
      el('p.muted', { style: 'font-size:.9rem;min-height:40px', text: l.desc }),
      el('div.row', { style: 'justify-content:space-between;margin-top:8px' }, [badge,
        el('span.faint', { text: locked ? '' : isDone ? 'Powtórz ↺' : 'Start →' }),
      ]),
    ]);
  }

  function analystSummary(mistakes) {
    if (!mistakes.length) return el('span');
    return el('div.card', { style: 'margin-top:8px' }, [
      el('h3.display', { style: 'margin:0 0 10px', text: '📋 Twój Analityk — zebrane błędy' }),
      ...mistakes.slice(-6).reverse().map((m) => el('div.mistake', {}, [
        el('div', {}, [ el('span.bad', { text: m.bad }), ' → ', el('span.good', { text: m.good }) ]),
        el('div.note', { text: m.note }),
      ])),
    ]);
  }
}
