import { el, navigate, feedbackCorner } from '../ui.js';
import { store } from '../state.js';
import { speech } from '../services/speech.js';
import { minutesWord, isFemale } from '../data/phrases.js';

// HISTORIA LEKCJI — Izabela rysuje przy konsoli (scene-17).
// Okienka lekcji (zwinięte do tytułu) rozrzucone w strefach, które NIE
// zasłaniają twarzy Izabeli ani kotów. Klik rozwija podsumowanie.
export function renderHistory(mount) {
  document.body.classList.add('on-lessons');
  window.addEventListener('hashchange', () => {
    document.body.classList.remove('on-lessons');
  }, { once: true });

  const screen = el('div.history-fs');
  mount.append(screen);

  const entries = [...(store.get().progress.history || [])].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

  function fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  }
  function fmtDur(sec) {
    const m = Math.max(1, Math.round((sec || 0) / 60));
    return `${m} ${minutesWord(m)}`;
  }

  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const name = (store.get().user?.name || '').trim();
  const addr = isFemale(name) ? 'koleżanko' : 'kolego';

  const fewJokes = [
    `Jeszcze tu pustki! Musisz to zmienić, ${addr}.`,
    'No, rozgadana historia to to jeszcze nie jest. Zmieniamy to?',
    'Ale echo! Trzeba tu nagadać trochę lekcji.',
    `Moje kotki mają więcej wpisów w dzienniczku niż Ty. Nadrabiamy, ${addr}!`,
    'Cieniutko tu jeszcze. Wpadaj na lekcję, a zaraz się zaroi.',
  ];
  const manyLines = [
    'Proszę bardzo, wszystko skrzętnie notuję. Zobacz, o czym gadaliśmy.',
    'Cała nasza historia jak na dłoni. Nieźle nam idzie, co?',
    'Wszystko zapisane, co do minuty. Lubię porządek w papierach.',
  ];
  const spoken = entries.length < 1 ? pick(fewJokes) : pick(manyLines);

  // Strefy na okienka — górny pas i dolny środek (z dala od twarzy w centrum
  // i kota z prawej na scene-17). Kolejne lekcje układają się warstwami.
  const SLOTS = [
    { l: 4, t: 6 }, { l: 30, t: 4 }, { l: 55, t: 5 }, { l: 76, t: 7 },
    { l: 3, t: 26 }, { l: 40, t: 84 }, { l: 60, t: 86 }, { l: 20, t: 88 },
  ];
  const cards = el('div.history-cards', {},
    entries.length
      ? entries.map((e, i) => {
          const s = SLOTS[i % SLOTS.length];
          const shift = (Math.floor(i / SLOTS.length) * 4) % 12;
          const card = el('div.history-item', {
            style: `left:${s.l + shift / 2}%; top:${Math.min(88, s.t + shift)}%`,
            title: 'Kliknij, aby rozwinąć',
            onclick: () => card.classList.toggle('open'),
          }, [
            el('div.history-item__head', {}, [
              el('span.history-item__kind', { text: e.kind === 'trial' ? 'Lekcja próbna' : 'Lekcja' }),
              el('span.history-item__meta', { text: `${fmtDate(e.startedAt)} · ${fmtDur(e.seconds)}` }),
            ]),
            el('p.history-item__sum', { text: e.summary || 'Podsumowanie pojawi się po rozmowie.' }),
          ]);
          return card;
        })
      : [],
  );

  // Dymek z tym, co mówi Izabela (lewy górny róg — bezpieczna strefa)
  const bubble = el('div.scene-bubble', {
    style: 'left:2%; top:14%', title: 'Kliknij, a powtórzę',
    onclick: () => speech.speak(spoken, { lang: 'pl-PL' }),
  }, [
    el('div.scene-bubble__who', { text: 'Izabela' }),
    el('p', { style: 'margin:0', text: spoken }),
  ]);

  screen.replaceChildren(
    el('header.lessons-fs__top', {}, [
      el('div.logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
      el('div.lessons-fs__tools', {}, [
        el('button.btn.btn--sq', { onclick: () => navigate('#/home') }, ['Wróć']),
      ]),
    ]),
    bubble,
    cards,
    feedbackCorner('historia lekcji'),
  );

  speech.speak(spoken, { lang: 'pl-PL' });
}
