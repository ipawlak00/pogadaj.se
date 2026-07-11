import { el, navigate, feedbackCorner } from '../ui.js';
import { store } from '../state.js';
import { speech } from '../services/speech.js';
import { minutesWord, isFemale } from '../data/phrases.js';

// HISTORIA LEKCJI — przytulna scena z kotami (scene-15, zapas: scene-08).
// Panel z lekcjami widoczny od razu, bez dodatkowych przycisków.
export function renderHistory(mount) {
  document.body.classList.add('on-lessons');
  window.addEventListener('hashchange', () => {
    document.body.classList.remove('on-lessons');
    speech.stopSpeaking();
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

  // Mało lekcji? Izabela żartuje, że tu pustki — kilka wariantów.
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
  const spoken = entries.length < 2 ? pick(fewJokes) : pick(manyLines);

  // Bez białego panelu: same okienka, rozrzucone po całym ekranie.
  // Kolejne lekcje zapełniają ekran wg stałych miejsc (deterministycznie).
  const SLOTS = [
    { l: 62, t: 8 },  { l: 34, t: 4 },  { l: 68, t: 34 }, { l: 38, t: 30 },
    { l: 64, t: 62 }, { l: 36, t: 58 }, { l: 6,  t: 14 }, { l: 8,  t: 44 },
    { l: 6,  t: 72 }, { l: 34, t: 82 }, { l: 62, t: 86 }, { l: 20, t: 60 },
  ];
  const cards = el('div.history-cards', {},
    entries.length
      ? entries.map((e, i) => {
          const s = SLOTS[i % SLOTS.length];
          const shift = (Math.floor(i / SLOTS.length) * 4) % 12;   // kolejne „warstwy" lekko przesunięte
          // Zwinięte okienko = sam tytuł z datą; klik rozwija podsumowanie
          const card = el('div.history-item', {
            style: `left:${s.l + shift / 2}%; top:${Math.min(84, s.t + shift)}%`,
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
      : [el('div.history-item.open', { style: 'left:58%; top:14%' }, [
          el('div.history-item__head', {}, [ el('span.history-item__kind', { text: 'Twoje lekcje' }) ]),
          el('p.history-item__sum', { text: spoken }),
        ])],
  );

  screen.replaceChildren(
    el('header.lessons-fs__top', {}, [
      el('div.logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
      el('div.lessons-fs__tools', {}, [
        el('button.btn.btn--sq', { onclick: () => navigate('#/home') }, ['Wróć']),
      ]),
    ]),
    cards,
    feedbackCorner('historia lekcji'),
  );

  speech.speak(spoken, { lang: 'pl-PL' });
}
