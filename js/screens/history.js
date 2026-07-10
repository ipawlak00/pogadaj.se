import { el, navigate, feedbackCorner } from '../ui.js';
import { store } from '../state.js';
import { speech } from '../services/speech.js';
import { minutesWord } from '../data/phrases.js';

// HISTORIA LEKCJI — Izabela przy komputerze (scene-08).
// Klik „Historia" na ekranie rozwija po prawej płynną listę lekcji:
// kiedy, ile trwała i o czym była rozmowa.
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

  const panel = el('div.history-panel', {}, [
    el('h2.display', { style: 'margin:0 0 12px;color:#14314f', text: 'Twoje lekcje' }),
    entries.length
      ? el('div.history-list', {}, entries.map((e) => el('div.history-item', {}, [
          el('div.history-item__head', {}, [
            el('span.history-item__kind', { text: e.kind === 'trial' ? 'Lekcja próbna' : 'Lekcja' }),
            el('span.history-item__meta', { text: `${fmtDate(e.startedAt)} · ${fmtDur(e.seconds)}` }),
          ]),
          el('p.history-item__sum', { text: e.summary || 'Podsumowanie pojawi się po rozmowie.' }),
        ])))
      : el('p', { style: 'color:#46688c', text: 'Jeszcze tu pusto. Wpadnij na lekcję, a wszystko zapiszę!' }),
  ]);

  const historyBtn = el('button.btn.btn--sq.history-open-btn', {
    onclick: () => {
      panel.classList.toggle('show');
      if (panel.classList.contains('show')) {
        speech.speak('Proszę bardzo, wszystko skrzętnie notuję. Zobacz, o czym gadaliśmy!', { lang: 'pl-PL' });
      }
    },
  }, ['Historia']);

  screen.replaceChildren(
    el('header.lessons-fs__top', {}, [
      el('div.logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
      el('div.lessons-fs__tools', {}, [
        el('button.btn.btn--ghost', { onclick: () => navigate('#/home') }, ['Wróć']),
      ]),
    ]),
    historyBtn,
    panel,
    feedbackCorner('historia lekcji'),
  );
}
