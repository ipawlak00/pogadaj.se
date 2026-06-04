import { el, topbar, toast, navigate } from '../ui.js';
import { store } from '../state.js';
import { auth } from '../services/auth.js';

const GOALS = [
  { id: 'work',   emoji: '💼', title: 'Praca / kariera',  desc: 'Rozmowy, maile, spotkania po angielsku.' },
  { id: 'travel', emoji: '✈️', title: 'Podróże',          desc: 'Dogadać się wszędzie na świecie.' },
  { id: 'exam',   emoji: '🎓', title: 'Egzamin / matura',  desc: 'Konkretne przygotowanie do testu.' },
  { id: 'fun',    emoji: '🎬', title: 'Dla siebie',        desc: 'Filmy, gry, znajomi — czysta frajda.' },
];

const LEVELS = [
  { id: 'A1', title: 'A1 — Początkujący', desc: 'Dopiero zaczynam, pojedyncze słowa.' },
  { id: 'A2', title: 'A2 — Podstawowy',   desc: 'Proste zdania, codzienne sytuacje.' },
  { id: 'B1', title: 'B1 — Średni',       desc: 'Daję radę w rozmowie, robię błędy.' },
  { id: 'B2', title: 'B2 — Wyżej średni', desc: 'Mówię swobodnie, chcę szlifu.' },
  { id: 'C1', title: 'C1 — Zaawansowany', desc: 'Płynnie, poleruję detale.' },
];

export function renderOnboarding(mount) {
  let step = 0;          // 0=cel, 1=poziom, 2=login
  const data = { goal: null, level: null };

  const screen = el('div.fade-in');
  mount.append(topbar(), screen);
  draw();

  function progressBar() {
    return el('div.progress', { style: 'margin:8px 0 28px' }, [ el('i', { style: `width:${(step / 3) * 100 + 12}%` }) ]);
  }

  function choiceGrid(items, selectedId, onPick) {
    return el('div.choice-grid', {}, items.map((it) =>
      el(`button.choice${selectedId === it.id ? '.selected' : ''}`, { onclick: () => onPick(it.id) }, [
        it.emoji ? el('div.emoji', { text: it.emoji }) : null,
        el('div.title', { text: it.title }),
        el('div.desc', { text: it.desc }),
      ])
    ));
  }

  function draw() {
    screen.replaceChildren();
    screen.append(progressBar());

    if (step === 0) {
      screen.append(el('div.stack', {}, [
        el('h1.display', { text: 'Do czego potrzebujesz angielskiego?' }),
        el('p.muted', { text: 'Dzięki temu Izabela dobierze tematy rozmów.' }),
        choiceGrid(GOALS, data.goal, (id) => { data.goal = id; draw(); }),
        el('div.row', { style: 'justify-content:flex-end;margin-top:24px' }, [
          el('button.btn.btn--primary', { disabled: !data.goal, onclick: () => { step = 1; draw(); } }, ['Dalej →']),
        ]),
      ]));
    }

    if (step === 1) {
      screen.append(el('div.stack', {}, [
        el('h1.display', { text: 'Jak oceniasz swój poziom?' }),
        el('p.muted', { text: 'Bez stresu — Izabela i tak sprawdzi to w praktyce.' }),
        choiceGrid(LEVELS, data.level, (id) => { data.level = id; draw(); }),
        el('div.row', { style: 'justify-content:space-between;margin-top:24px' }, [
          el('button.btn.btn--ghost', { onclick: () => { step = 0; draw(); } }, ['← Wstecz']),
          el('button.btn.btn--primary', { disabled: !data.level, onclick: () => { step = 2; draw(); } }, ['Dalej →']),
        ]),
      ]));
    }

    if (step === 2) {
      screen.append(el('div.stack.center', { style: 'max-width:420px;margin:4vh auto' }, [
        el('h1.display', { text: 'Ostatni krok 🚀' }),
        el('p.muted', { text: 'Zaloguj się, żeby zapisać postępy i swój profil fonetyczny.' }),
        el('button.btn.btn--block.btn--lg', {
          style: 'background:#fff;color:#1a1a1a',
          onclick: handleLogin,
        }, ['🔵 Zaloguj się przez Google']),
        el('button.btn.btn--ghost.btn--block', { onclick: handleLogin }, ['Wejdź jako gość (na próbę)']),
        el('div.row', { style: 'justify-content:center;margin-top:8px' }, [
          el('button.btn.btn--ghost', { onclick: () => { step = 1; draw(); } }, ['← Wstecz']),
        ]),
      ]));
    }
  }

  async function handleLogin() {
    try {
      await auth.signInWithGoogle();
      store.completeOnboarding(data.goal, data.level);
      toast('Witaj na pokładzie! 🌌');
      navigate('#/intro');
    } catch (e) {
      toast(e.message || 'Logowanie nie powiodło się', 'error');
    }
  }
}
