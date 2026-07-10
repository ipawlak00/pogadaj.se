import { el, topbar, toast, navigate } from '../ui.js';
import { store } from '../state.js';
import { auth, passwordProblem } from '../services/auth.js';
import { speech } from '../services/speech.js';
import { ai } from '../services/ai.js';

const GOALS = [
  { id: 'work',   title: 'Praca / kariera',  desc: 'Rozmowy, maile, spotkania po angielsku.' },
  { id: 'travel', title: 'Podróże',          desc: 'Dogadać się wszędzie na świecie.' },
  { id: 'exam',   title: 'Egzamin / matura', desc: 'Konkretne przygotowanie do testu.' },
  { id: 'fun',    title: 'Dla siebie',       desc: 'Filmy, gry, znajomi. Czysta frajda.' },
];

const LEVELS = [
  { id: 'A1', title: 'A1, Początkujący', desc: 'Dopiero zaczynam, pojedyncze słowa.' },
  { id: 'A2', title: 'A2, Podstawowy',   desc: 'Proste zdania, codzienne sytuacje.' },
  { id: 'B1', title: 'B1, Średni',       desc: 'Daję radę w rozmowie, robię błędy.' },
  { id: 'B2', title: 'B2, Wyżej średni', desc: 'Mówię swobodnie, chcę szlifu.' },
  { id: 'C1', title: 'C1, Zaawansowany', desc: 'Płynnie, poleruję detale.' },
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Przepływ: konto (imię+email+hasło) → FILM (Izabela się przedstawia)
// → cel + poziom → paszport fonetyczny.
export function renderOnboarding(mount) {
  const hasAccount = !!store.get().user?.token;
  if (!hasAccount) return renderSignup(mount);   // etap 1: założenie konta
  return renderProfile(mount);                    // etap 2 (po filmie): cel i poziom
}

// ---------- ETAP 1: konto — imię (wpisz albo powiedz), email, hasło ----------
function renderSignup(mount) {
  const BUBBLE = 'Cześć! Jestem Izabela, Twoja kosmiczna nauczycielka angielskiego. Zdradź mi swoje imię, podaj email i hasło, a zaraz potem pokażę Ci mój statek!';

  const screen = el('div.fade-in');
  mount.append(topbar(), screen);
  window.addEventListener('hashchange', () => speech.stopSpeaking(), { once: true });

  const nameInput = el('input', { type: 'text', placeholder: 'Twoje imię, np. Kasia', maxlength: '30', autocomplete: 'given-name' });
  const emailInput = el('input', { type: 'email', placeholder: 'twój@email.com', autocomplete: 'email' });
  const passInput = el('input', { type: 'password', placeholder: 'Hasło', autocomplete: 'new-password' });
  const submitBtn = el('button.btn.btn--primary.btn--block.btn--lg', { onclick: submit }, ['Załóż konto i lecimy']);
  const sayBtn = el('button.btn.btn--sq', { onclick: sayName }, ['Powiedz imię']);

  let recing = false, handle = null;
  async function sayName() {
    if (recing) { handle?.stop(); return; }
    if (!speech.canRecord()) { toast('Mikrofon niedostępny w tej przeglądarce — wpisz imię', 'error'); return; }
    speech.stopSpeaking();
    try {
      handle = await speech.recordAudio({ autoStop: true, silenceMs: 1100, maxMs: 6000, onStop: finishRec });
    } catch (e) { toast('Mikrofon: ' + (e.message || e), 'error'); return; }
    recing = true; sayBtn.textContent = 'Słucham…';
  }
  async function finishRec() {
    if (!recing) return;
    recing = false; sayBtn.disabled = true; sayBtn.textContent = 'Chwila…';
    const h = handle; handle = null;
    let text = null;
    try { const audio = await h.done; text = await ai.transcribe(audio); } catch (e) { /* ignore */ }
    sayBtn.disabled = false; sayBtn.textContent = 'Powiedz imię';
    const name = extractName(text);
    if (!name) { toast('Nie dosłyszałam — powiedz jeszcze raz albo wpisz', 'error'); return; }
    nameInput.value = name;
    speech.speak(pick([
      `No i super, miło Cię poznać, ${name}!`,
      `${name}? Mocne! Miło Cię poznać.`,
      `O, ${name}! Ale farcik, uwielbiam to imię.`,
    ]), { lang: 'pl-PL' });
    emailInput.focus();
  }

  async function submit() {
    const name = nameInput.value.trim();
    if (!name) { toast('Zdradź imię — chcę wiedzieć, jak się do Ciebie zwracać', 'error'); return; }
    const email = emailInput.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Podaj poprawny adres email', 'error'); return; }
    const pp = passwordProblem(passInput.value);
    if (pp) { toast(pp, 'error'); return; }
    submitBtn.disabled = true; submitBtn.textContent = 'Zakładam konto…';
    try {
      await auth.register({ name, email, password: passInput.value });
      toast('Konto założone!');
      navigate('#/intro');                      // FILM zaraz po utworzeniu konta
    } catch (e) {
      submitBtn.disabled = false; submitBtn.textContent = 'Załóż konto i lecimy';
      toast(e.message || 'Nie udało się założyć konta', 'error');
    }
  }
  passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  screen.replaceChildren(el('div.iza-card.fade-in', {}, [
    el('div.iza-card__stage', {}, [
      el('img', { src: 'assets/scenes/scene-05.jpg', alt: 'Izabela',
        onerror: function () { this.onerror = null; this.src = 'assets/izabela/izabela-lesson.png'; } }),
      el('div.iza-card__bubble', { text: BUBBLE }),
    ]),
    el('div.iza-card__main', {}, [
      el('h2.display', { style: 'margin:0', text: 'Załóż darmowe konto' }),
      el('p', { style: 'margin:8px 0 4px;color:#46688c', text: 'Zapiszę Twoje postępy, profil wymowy i czas lekcji próbnej.' }),
      el('div.field', { style: 'margin-top:10px' }, [nameInput]),
      el('div.row', { style: 'justify-content:flex-start;margin:0 0 6px' }, [sayBtn]),
      el('div.field', {}, [emailInput]),
      el('div.field', {}, [passInput]),
      el('p', { style: 'margin:0 0 10px;color:#7b96b3;font-size:.82rem', text: 'Hasło: minimum 8 znaków, wielka litera i znak specjalny.' }),
      submitBtn,
      el('div.row', { style: 'justify-content:center;margin-top:10px' }, [
        el('button.btn.btn--ghost', { onclick: () => navigate('#/') }, ['Wstecz']),
      ]),
    ]),
  ]));
  speech.speak(BUBBLE, { lang: 'pl-PL' });
  setTimeout(() => nameInput.focus(), 50);
}

// ---------- ETAP 2 (po filmie): cel i poziom ----------
function renderProfile(mount) {
  const BUBBLES = [
    'Do czego potrzebujesz angielskiego? Dzięki temu dobiorę Ci tematy rozmów.',
    'Jak oceniasz swój poziom? Tylko bez stresu, i tak sprawdzę w praktyce.',
  ];
  let step = 0;                                  // 0=cel, 1=poziom
  const data = { goal: null, level: null };

  const screen = el('div.fade-in');
  mount.append(topbar(), screen);
  window.addEventListener('hashchange', () => speech.stopSpeaking(), { once: true });

  let spokenStep = -1;
  function speakStep() {
    if (spokenStep === step) return;
    spokenStep = step;
    speech.speak(BUBBLES[step], { lang: 'pl-PL' });
  }

  function choiceGrid(items, getSel, onPick, nextBtn) {
    const grid = el('div.choice-grid');
    items.forEach((it) => {
      const b = el(`button.choice${getSel() === it.id ? '.selected' : ''}`, {
        onclick: () => {
          onPick(it.id);
          [...grid.children].forEach((c) => c.classList.remove('selected'));
          b.classList.add('selected');
          if (nextBtn) nextBtn.disabled = false;
        },
      }, [
        el('div.title', { text: it.title }),
        el('div.desc', { text: it.desc }),
      ]);
      grid.append(b);
    });
    return grid;
  }

  function draw() {
    const izaSide = el('div.iza-card__stage', {}, [
      el('img', { src: 'assets/scenes/scene-05.jpg', alt: 'Izabela',
        onerror: function () { this.onerror = null; this.src = 'assets/izabela/izabela-lesson.png'; } }),
      el('div.iza-card__bubble', { text: BUBBLES[step] }),
    ]);
    const card = el('div.iza-card__main', {});
    card.append(el('div.progress', { style: 'margin:4px 0 20px' }, [ el('i', { style: `width:${step === 0 ? 55 : 85}%` }) ]));

    if (step === 0) {
      const nextBtn = el('button.btn.btn--primary', { disabled: !data.goal, onclick: () => { step = 1; draw(); } }, ['Dalej']);
      card.append(
        el('h2.display', { style: 'margin:0 0 12px', text: 'Do czego potrzebujesz angielskiego?' }),
        choiceGrid(GOALS, () => data.goal, (id) => { data.goal = id; }, nextBtn),
        el('div.row', { style: 'justify-content:flex-end;margin-top:18px' }, [nextBtn]),
      );
    }

    if (step === 1) {
      const finishBtn = el('button.btn.btn--primary', {
        disabled: !data.level,
        onclick: () => {
          store.completeOnboarding(data.goal, data.level);
          navigate('#/phonetic');
        },
      }, ['Zaczynamy']);
      card.append(
        el('h2.display', { style: 'margin:0 0 12px', text: 'Jak oceniasz swój poziom?' }),
        choiceGrid(LEVELS, () => data.level, (id) => { data.level = id; }, finishBtn),
        el('div.row', { style: 'justify-content:space-between;margin-top:18px' }, [
          el('button.btn.btn--ghost', { onclick: () => { step = 0; draw(); } }, ['Wstecz']),
          finishBtn,
        ]),
      );
    }

    screen.replaceChildren(el('div.iza-card.fade-in', {}, [izaSide, card]));
    speakStep();
  }
  draw();
}

// Z transkrypcji („Mam na imię Kasia") wyciąga samo imię
function extractName(t) {
  const words = String(t || '')
    .replace(/[^A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]/g, ' ')
    .trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const w = words[words.length - 1];
  if (w.length < 2 || w.length > 20) return '';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}
