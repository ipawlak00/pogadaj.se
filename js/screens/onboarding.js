import { el, topbar, toast, navigate } from '../ui.js';
import { store } from '../state.js';
import { auth } from '../services/auth.js';
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

// Kwestie Izabeli (mówione i w dymku) — kolejność: imię → cel → poziom
const BUBBLES = [
  'No hej, dobrze Cię tu mieć! Zanim ruszymy w kosmos, powiedz mi, jak masz na imię? Możesz wpisać albo po prostu powiedzieć.',
  'Do czego potrzebujesz angielskiego? Dzięki temu dobiorę Ci tematy rozmów.',
  'Jak oceniasz swój poziom? Tylko bez stresu, i tak sprawdzę w praktyce.',
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Reakcja na imię, gdy AI chwilowo milczy (specjalna jarka na imienniczkę!)
function fallbackReaction(name) {
  if (/^izabela$/i.test(name)) {
    return pick([
      'CO?! Też Izabela?! No to mamy dream team, siostro!',
      'Nie wierzę, druga Izabela na pokładzie! To będzie legendarne.',
      'Też Izabela? Zajawka level sto, imienniczko!',
    ]);
  }
  return pick([
    `No i git, ${name}. Miło Cię poznać!`,
    `${name}? Mocne imię.`,
    `O, ${name}! Czuję, że będzie z nami niezła jazda.`,
    `${name}, brzmi jak ktoś, kto da radę.`,
  ]);
}

// Przepływ: konto (email+hasło na ekranie logowania) → FILM → tutaj:
// imię (z żywą reakcją Izabeli) → cel → poziom → paszport.
export function renderOnboarding(mount) {
  if (!store.get().user?.token && !store.get().user) { navigate('#/'); return; }

  // Po filmie ZAWSZE zaczynamy od przedstawienia się i imienia (nawet jeśli imię
  // jest już znane — wtedy podpowiadamy je w polu). Wcześniej pomijało ten krok.
  let step = 0;
  const knownName = (store.get().user?.name || '').trim();
  const data = { name: knownName, goal: null, level: null };

  const screen = el('div.fade-in');
  mount.append(topbar(), screen);
  // mowę wygasza router (app.js) przy zmianie ekranu

  let spokenStep = -1;
  function speakStep(extra) {
    if (spokenStep === step) return;
    spokenStep = step;
    speech.speak((extra ? extra + ' ' : '') + BUBBLES[step], { lang: 'pl-PL' });
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

  draw();

  // Po poznaniu imienia: zapis + ŻYWA reakcja (AI z limitem czasu, inaczej pula)
  async function onName(name) {
    data.name = name;
    auth.setName(name);                      // serwer + lokalnie (w tle)
    step = 1;
    let reaction = null;
    try {
      reaction = await Promise.race([
        ai.reactToName(name),
        new Promise((r) => setTimeout(() => r(null), 2500)),
      ]);
    } catch (e) { /* ignore */ }
    spokenStep = 1;                          // reakcja + pytanie o cel jednym tchem
    draw();
    speech.speak(`${reaction || fallbackReaction(name)} ${BUBBLES[1]}`, { lang: 'pl-PL' });
  }

  function draw(spokenExtra) {
    const izaSide = el('div.iza-card__stage', {}, [
      el('img', { src: 'assets/scenes/scene-05.jpg', alt: 'Izabela',
        onerror: function () { this.onerror = null; this.src = 'assets/izabela/izabela-lesson.png'; } }),
      el('div.iza-card__bubble', { text: BUBBLES[step] }),
    ]);
    const card = el('div.iza-card__main', {});
    card.append(el('div.progress', { style: 'margin:4px 0 20px' }, [ el('i', { style: `width:${[18, 52, 85][step]}%` }) ]));

    // ---------- krok 0: imię (wpisz albo POWIEDZ) ----------
    if (step === 0) {
      const nameInput = el('input', { type: 'text', value: knownName, placeholder: 'np. Kasia', maxlength: '30', autocomplete: 'given-name' });
      const goNext = () => {
        const v = nameInput.value.trim();
        if (!v) { toast('Zdradź imię — chcę wiedzieć, jak się do Ciebie zwracać', 'error'); return; }
        onName(v);
      };
      nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') goNext(); });

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
      const nextBtn = el('button.btn.btn--primary', { disabled: !data.goal, onclick: () => { step = 2; draw(); } }, ['Dalej']);
      card.append(
        el('h2.display', { style: 'margin:0 0 12px', text: 'Do czego potrzebujesz angielskiego?' }),
        choiceGrid(GOALS, () => data.goal, (id) => { data.goal = id; }, nextBtn),
        el('div.row', { style: 'justify-content:space-between;margin-top:18px' }, [
          el('button.btn.btn--ghost', { onclick: () => { step = 0; draw(); } }, ['Wstecz']),
          nextBtn,
        ]),
      );
    }

    // ---------- krok 2: poziom ----------
    if (step === 2) {
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
          el('button.btn.btn--ghost', { onclick: () => { step = 1; draw(); } }, ['Wstecz']),
          finishBtn,
        ]),
      );
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
