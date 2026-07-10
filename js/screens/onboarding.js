import { el, topbar, toast, navigate } from '../ui.js';
import { store } from '../state.js';
import { auth } from '../services/auth.js';
import { speech } from '../services/speech.js';

const GOALS = [
  { id: 'work',   title: 'Praca / kariera',  desc: 'Rozmowy, maile, spotkania po angielsku.' },
  { id: 'travel', title: 'Podróże',          desc: 'Dogadać się wszędzie na świecie.' },
  { id: 'exam',   title: 'Egzamin / matura', desc: 'Konkretne przygotowanie do testu.' },
  { id: 'fun',    title: 'Dla siebie',       desc: 'Filmy, gry, znajomi — czysta frajda.' },
];

const LEVELS = [
  { id: 'A1', title: 'A1 — Początkujący', desc: 'Dopiero zaczynam, pojedyncze słowa.' },
  { id: 'A2', title: 'A2 — Podstawowy',   desc: 'Proste zdania, codzienne sytuacje.' },
  { id: 'B1', title: 'B1 — Średni',       desc: 'Daję radę w rozmowie, robię błędy.' },
  { id: 'B2', title: 'B2 — Wyżej średni', desc: 'Mówię swobodnie, chcę szlifu.' },
  { id: 'C1', title: 'C1 — Zaawansowany', desc: 'Płynnie, poleruję detale.' },
];

// Izabela mówi w PIERWSZEJ osobie — to ona rozmawia z uczniem, nikt o niej nie opowiada
const BUBBLES = [
  'Cześć! Jestem Izabela — Twoja kosmiczna nauczycielka angielskiego. A Ty? Zdradź mi swoje imię!',
  'Do czego potrzebujesz angielskiego? Dzięki temu dobiorę Ci tematy rozmów.',
  'Jak oceniasz swój poziom? Tylko bez stresu — i tak sprawdzę w praktyce.',
  'Ostatni krok! Zapisz postępy, żebym Cię pamiętała następnym razem.',
];

export function renderOnboarding(mount) {
  let step = 0;          // 0=imię, 1=cel, 2=poziom, 3=login
  const data = { name: '', goal: null, level: null };

  const screen = el('div.fade-in');
  mount.append(topbar(), screen);

  // Wyjście z ekranu = cisza
  window.addEventListener('hashchange', () => speech.stopSpeaking(), { once: true });

  // Izabela MÓWI swoją kwestię przy każdym kroku (raz na krok)
  let spokenStep = -1;
  function speakStep() {
    if (spokenStep === step) return;
    spokenStep = step;
    speech.speak(BUBBLES[step], { lang: 'pl-PL' });
  }

  draw();

  function progressBar() {
    return el('div.progress', { style: 'margin:4px 0 20px' }, [ el('i', { style: `width:${(step / 4) * 100 + 10}%` }) ]);
  }

  function choiceGrid(items, selectedId, onPick) {
    return el('div.choice-grid', {}, items.map((it) =>
      el(`button.choice${selectedId === it.id ? '.selected' : ''}`, { onclick: () => onPick(it.id) }, [
        el('div.title', { text: it.title }),
        el('div.desc', { text: it.desc }),
      ])
    ));
  }

  function draw() {
    // Lewa strona karty: Izabela (patrzy na ucznia) + dymek z jej kwestią
    const izaSide = el('div.iza-card__stage', {}, [
      el('img', { src: 'assets/scenes/scene-05.jpg', alt: 'Izabela',
        onerror: function () { this.onerror = null; this.src = 'assets/izabela/izabela-lesson.png'; } }),
      el('div.iza-card__bubble', { text: BUBBLES[step] }),
    ]);

    const card = el('div.iza-card__main', {});
    card.append(progressBar());

    if (step === 0) {
      const nameInput = el('input', { type: 'text', placeholder: 'np. Kasia', value: data.name, maxlength: '30', autocomplete: 'given-name' });
      const goNext = () => {
        const v = nameInput.value.trim();
        if (!v) { toast('Zdradź imię — chcę wiedzieć, jak się do Ciebie zwracać', 'error'); return; }
        data.name = v; step = 1; draw();
      };
      nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') goNext(); });
      card.append(
        el('h2.display', { style: 'margin:0', text: 'Jak masz na imię?' }),
        el('div.field', { style: 'margin-top:12px' }, [nameInput]),
        el('div.row', { style: 'justify-content:flex-end;margin-top:18px' }, [
          el('button.btn.btn--primary', { onclick: goNext }, ['Dalej']),
        ]),
      );
      setTimeout(() => nameInput.focus(), 50);
    }

    if (step === 1) {
      card.append(
        el('h2.display', { style: 'margin:0 0 12px', text: 'Do czego potrzebujesz angielskiego?' }),
        choiceGrid(GOALS, data.goal, (id) => { data.goal = id; draw(); }),
        el('div.row', { style: 'justify-content:space-between;margin-top:18px' }, [
          el('button.btn.btn--ghost', { onclick: () => { step = 0; draw(); } }, ['Wstecz']),
          el('button.btn.btn--primary', { disabled: !data.goal, onclick: () => { step = 2; draw(); } }, ['Dalej']),
        ]),
      );
    }

    if (step === 2) {
      card.append(
        el('h2.display', { style: 'margin:0 0 12px', text: 'Jak oceniasz swój poziom?' }),
        choiceGrid(LEVELS, data.level, (id) => { data.level = id; draw(); }),
        el('div.row', { style: 'justify-content:space-between;margin-top:18px' }, [
          el('button.btn.btn--ghost', { onclick: () => { step = 1; draw(); } }, ['Wstecz']),
          el('button.btn.btn--primary', { disabled: !data.level, onclick: () => { step = 3; draw(); } }, ['Dalej']),
        ]),
      );
    }

    if (step === 3) {
      card.append(
        el('h2.display', { style: 'margin:0', text: 'Ostatni krok' }),
        el('p', { style: 'margin:8px 0 14px;color:#46688c', text: 'Zapisz postępy i swój profil wymowy.' }),
        el('button.btn.btn--block.btn--lg', { style: 'background:#fff;color:#16305a;border:2px solid #cfe6f8', onclick: handleLogin }, ['Zaloguj się przez Google']),
        el('button.btn.btn--ghost.btn--block', { style: 'margin-top:10px', onclick: handleLogin }, ['Wejdź jako gość (na próbę)']),
        el('div.row', { style: 'justify-content:center;margin-top:10px' }, [
          el('button.btn.btn--ghost', { onclick: () => { step = 2; draw(); } }, ['Wstecz']),
        ]),
      );
    }

    screen.replaceChildren(el('div.iza-card.fade-in', {}, [izaSide, card]));
    speakStep();
  }

  async function handleLogin() {
    try {
      await auth.signInWithGoogle();
      if (data.name) store.patchKey('user', { ...(store.get().user || {}), name: data.name });
      store.completeOnboarding(data.goal, data.level);
      toast('Witaj na pokładzie!');
      navigate('#/intro');
    } catch (e) {
      toast(e.message || 'Logowanie nie powiodło się', 'error');
    }
  }
}
