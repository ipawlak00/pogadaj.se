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

// Izabela mówi w PIERWSZEJ osobie — to ona rozmawia z uczniem
const BUBBLES = [
  'Cześć! Jestem Izabela, Twoja kosmiczna nauczycielka angielskiego. A Ty? Zdradź mi swoje imię! Możesz je wpisać albo po prostu powiedzieć.',
  'Do czego potrzebujesz angielskiego? Dzięki temu dobiorę Ci tematy rozmów.',
  'Jak oceniasz swój poziom? Tylko bez stresu, i tak sprawdzę w praktyce.',
  'Załóż konto, żebym Cię pamiętała. Email, hasło i lecimy!',
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function renderOnboarding(mount) {
  const st = store.get();
  const hasAccount = !!st.user?.token;                 // zalogowany — bez kroku rejestracji
  const knownName = (st.user?.name || '').trim();

  let step = hasAccount && knownName ? 1 : 0;          // 0=imię, 1=cel, 2=poziom, 3=konto
  const data = { name: knownName, goal: null, level: null };

  const screen = el('div.fade-in');
  mount.append(topbar(), screen);

  // Wyjście z ekranu = cisza
  window.addEventListener('hashchange', () => speech.stopSpeaking(), { once: true });

  // Izabela MÓWI swoją kwestię przy każdym kroku (raz na krok)
  let spokenStep = -1;
  function speakStep(extra) {
    if (spokenStep === step) return;
    spokenStep = step;
    speech.speak((extra ? extra + ' ' : '') + BUBBLES[step], { lang: 'pl-PL' });
  }

  draw();

  function progressBar() {
    const total = hasAccount ? 3 : 4;
    return el('div.progress', { style: 'margin:4px 0 20px' }, [ el('i', { style: `width:${(step / total) * 100 + 10}%` }) ]);
  }

  // Wybór podświetla się W MIEJSCU (bez przerysowywania ekranu) — dalej idziemy przyciskiem
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

  function goToStep(n, spokenExtra) {
    step = n;
    draw(spokenExtra);
  }

  function draw(spokenExtra) {
    const izaSide = el('div.iza-card__stage', {}, [
      el('img', { src: 'assets/scenes/scene-05.jpg', alt: 'Izabela',
        onerror: function () { this.onerror = null; this.src = 'assets/izabela/izabela-lesson.png'; } }),
      el('div.iza-card__bubble', { text: BUBBLES[step] }),
    ]);

    const card = el('div.iza-card__main', {});
    card.append(progressBar());

    // ---------- krok 0: imię (wpisz albo POWIEDZ) ----------
    if (step === 0) {
      const nameInput = el('input', { type: 'text', placeholder: 'np. Kasia', value: data.name, maxlength: '30', autocomplete: 'given-name' });
      const goNext = () => {
        const v = nameInput.value.trim();
        if (!v) { toast('Zdradź imię — chcę wiedzieć, jak się do Ciebie zwracać', 'error'); return; }
        data.name = v;
        const reaction = pick([
          `No i super, miło Cię poznać, ${v}!`,
          `${v}? Mocne! Miło Cię poznać.`,
          `O, ${v}! Ale farcik, uwielbiam to imię.`,
          `${v}, piękna sprawa. No to lecimy!`,
        ]);
        goToStep(1, reaction);
      };
      nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') goNext(); });

      // Mikrofon: powiedz imię, Izabela je wyłapie
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
        goNext();
      }

      card.append(
        el('h2.display', { style: 'margin:0', text: 'Jak masz na imię?' }),
        el('div.field', { style: 'margin-top:12px' }, [nameInput]),
        el('div.row', { style: 'justify-content:space-between;margin-top:18px' }, [
          sayBtn,
          el('button.btn.btn--primary', { onclick: goNext }, ['Dalej']),
        ]),
      );
      setTimeout(() => nameInput.focus(), 50);
    }

    // ---------- krok 1: cel ----------
    if (step === 1) {
      const nextBtn = el('button.btn.btn--primary', { disabled: !data.goal, onclick: () => goToStep(2) }, ['Dalej']);
      card.append(
        el('h2.display', { style: 'margin:0 0 12px', text: 'Do czego potrzebujesz angielskiego?' }),
        choiceGrid(GOALS, () => data.goal, (id) => { data.goal = id; }, nextBtn),
        el('div.row', { style: 'justify-content:space-between;margin-top:18px' }, [
          el('button.btn.btn--ghost', { onclick: () => goToStep(0) }, ['Wstecz']),
          nextBtn,
        ]),
      );
    }

    // ---------- krok 2: poziom ----------
    if (step === 2) {
      const finishNoAccount = () => goToStep(3);
      const finishWithAccount = () => {
        store.completeOnboarding(data.goal, data.level);
        navigate('#/intro');
      };
      const nextBtn = el('button.btn.btn--primary', {
        disabled: !data.level,
        onclick: hasAccount ? finishWithAccount : finishNoAccount,
      }, [hasAccount ? 'Zaczynamy' : 'Dalej']);
      card.append(
        el('h2.display', { style: 'margin:0 0 12px', text: 'Jak oceniasz swój poziom?' }),
        choiceGrid(LEVELS, () => data.level, (id) => { data.level = id; }, nextBtn),
        el('div.row', { style: 'justify-content:space-between;margin-top:18px' }, [
          el('button.btn.btn--ghost', { onclick: () => goToStep(1) }, ['Wstecz']),
          nextBtn,
        ]),
      );
    }

    // ---------- krok 3: założenie konta (email + hasło) ----------
    if (step === 3) {
      const emailInput = el('input', { type: 'email', placeholder: 'twój@email.com', autocomplete: 'email' });
      const passInput = el('input', { type: 'password', placeholder: 'Hasło', autocomplete: 'new-password' });
      const submitBtn = el('button.btn.btn--primary.btn--block.btn--lg', { onclick: submit }, ['Załóż konto i lecimy']);

      async function submit() {
        const email = emailInput.value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Podaj poprawny adres email', 'error'); return; }
        const pp = passwordProblem(passInput.value);
        if (pp) { toast(pp, 'error'); return; }
        submitBtn.disabled = true; submitBtn.textContent = 'Zakładam konto…';
        try {
          await auth.register({ name: data.name, email, password: passInput.value });
          store.completeOnboarding(data.goal, data.level);
          speech.speak(`No i cyk, konto gotowe! ${data.name}, od teraz wszystko pamiętam. Lecimy z tematem!`, { lang: 'pl-PL' });
          toast('Konto założone!');
          navigate('#/intro');
        } catch (e) {
          submitBtn.disabled = false; submitBtn.textContent = 'Załóż konto i lecimy';
          toast(e.message || 'Nie udało się założyć konta', 'error');
        }
      }
      passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

      card.append(
        el('h2.display', { style: 'margin:0', text: 'Załóż darmowe konto' }),
        el('p', { style: 'margin:8px 0 4px;color:#46688c', text: 'Zapiszę Twoje postępy, profil wymowy i czas lekcji próbnej.' }),
        el('div.field', { style: 'margin-top:10px' }, [emailInput]),
        el('div.field', {}, [passInput]),
        el('p', { style: 'margin:0 0 10px;color:#7b96b3;font-size:.82rem', text: 'Hasło: minimum 8 znaków, wielka litera i znak specjalny.' }),
        submitBtn,
        el('div.row', { style: 'justify-content:center;margin-top:10px' }, [
          el('button.btn.btn--ghost', { onclick: () => goToStep(2) }, ['Wstecz']),
        ]),
      );
      setTimeout(() => emailInput.focus(), 50);
    }

    screen.replaceChildren(el('div.iza-card.fade-in', {}, [izaSide, card]));
    speakStep(spokenExtra);
  }
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
