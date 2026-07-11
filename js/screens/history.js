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

  const panel = el('div.history-panel.show', {}, [
    el('h2.display', { style: 'margin:0 0 12px;color:#14314f', text: 'Twoje lekcje' }),
    entries.length
      ? el('div.history-list', {}, entries.map((e) => el('div.history-item', {}, [
          el('div.history-item__head', {}, [
            el('span.history-item__kind', { text: e.kind === 'trial' ? 'Lekcja próbna' : 'Lekcja' }),
            el('span.history-item__meta', { text: `${fmtDate(e.startedAt)} · ${fmtDur(e.seconds)}` }),
          ]),
          el('p.history-item__sum', { text: e.summary || 'Podsumowanie pojawi się po rozmowie.' }),
        ])))
      : el('p', { style: 'color:#46688c', text: spoken }),
  ]);

  screen.replaceChildren(
    el('header.lessons-fs__top', {}, [
      el('div.logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
      el('div.lessons-fs__tools', {}, [
        el('button.btn.btn--ghost', { onclick: () => navigate('#/home') }, ['Wróć']),
      ]),
    ]),
    panel,
    feedbackCorner('historia lekcji'),
  );

  speech.speak(spoken, { lang: 'pl-PL' });
}
