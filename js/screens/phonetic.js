import { el, topbar, toast, navigate } from '../ui.js';
import { store } from '../state.js';
import { speech } from '../services/speech.js';
import { ai } from '../services/ai.js';
import { PHONETIC_WORDS } from '../data/phonetic-words.js';

export function renderPhonetic(mount) {
  const words = PHONETIC_WORDS;
  let idx = 0;
  const results = [];
  let recorder = null;
  let recording = false;
  let lastSpoken = -1;
  let attempts = 0;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const screen = el('div.fade-in');
  mount.append(topbar(), screen);
  draw();

  // Izabela czyta słówko (powoli, wyraźnie), żeby uczeń wiedział jak brzmi
  function speakWord() {
    speech.speak(words[idx].word, { lang: 'en-US', rate: 0.85 });
  }

  function dots() {
    return el('div.word-dots', {}, words.map((_, i) =>
      el(`i${i < idx ? '.done' : i === idx ? '.active' : ''}`)));
  }

  function draw() {
    const w = words[idx];
    screen.replaceChildren(
      el('div.center.stack', { style: 'gap:6px;margin-bottom:18px' }, [
        el('div.pill', { style: 'margin:0 auto', text: `🎤 Paszport Fonetyczny · ${idx + 1}/${words.length}` }),
        el('p.muted', { style: 'margin:6px 0 0', text: '1) Posłuchaj, jak Izabela czyta słowo.  2) Powtórz je do mikrofonu.' }),
      ]),
      el('div.card.center.stack', { style: 'max-width:560px;margin:0 auto;gap:14px' }, [
        el('div.phonetic-word', { text: w.word }),
        el('div.phonetic-ipa', { text: w.ipa }),
        el('button.btn.btn--ghost', { style: 'margin:0 auto', onclick: speakWord }, ['🔊 Posłuchaj jeszcze raz']),
        el('div.phonetic-hint', { text: w.hint }),
        el('div.spacer-sm'),
        el(`button.mic-btn${recording ? '.recording' : ''}`, { onclick: toggleRec, 'aria-label': 'Nagraj' }, [recording ? '⏹' : '🎙']),
        el('div.faint', { id: 'phon-status', text: recording ? 'Słucham... powiedz słowo' : 'Dotknij mikrofon i powtórz słowo' }),
        el('div.row', { style: 'justify-content:center;gap:10px;margin-top:6px' }, [
          el('button.btn.btn--ghost', { onclick: skip }, ['Pomiń słowo']),
        ]),
      ]),
      el('div.spacer'),
      dots(),
    );
    if (!speech.isRecognitionSupported()) {
      setStatus('⚠️ Twoja przeglądarka nie wspiera mikrofonu — możesz pomijać słowa.');
    }
    // Automatycznie przeczytaj słowo, gdy pojawia się nowe (nie przy zmianie stanu nagrywania)
    if (!recording && lastSpoken !== idx) { lastSpoken = idx; speakWord(); }
  }

  function setStatus(text) { const s = document.getElementById('phon-status'); if (s) s.textContent = text; }

  function toggleRec() {
    if (recording) { recorder?.stop(); return; }
    recording = true; draw();
    let heard = '';
    recorder = speech.listen({
      lang: 'en-US',
      onResult: (text) => { heard = text; setStatus(`Słyszę: „${text}"`); },
      onError: (err) => { toast('Mikrofon: ' + (err.message || err), 'error'); recording = false; draw(); },
      onEnd: async () => {
        recording = false;
        const w = words[idx];
        const res = await ai.analyzeWord({ target: w, heard });

        if (res.ok) {
          // Udało się — pochwała i przejście dalej (po polsku, kumpelsko)
          results.push(res);
          const praise = pick(['Ekstra! Idealnie. 🎉', 'O, super to wyszło! 👏', 'Brawo ziomek, dokładnie tak!']);
          setStatus('✅ ' + praise + ' Lecimy dalej…');
          speech.speak('Super!', { lang: 'pl-PL' });
          setTimeout(() => next(), 1300);
        } else {
          // Nie do końca — bez przeskakiwania, zachęcamy do kolejnej próby
          attempts++;
          draw();   // przywróć przycisk mikrofonu (🎙) do ponownej próby
          setStatus(`🙂 Ej, prawie! Posłuchaj jeszcze raz i powtórz: „${w.word}". Spróbuj śmiało, masz to!`);
          speech.speak(w.word, { lang: 'en-US', rate: 0.8 });
        }
      },
    });
  }

  // Świadome pominięcie (przycisk) — dopiero to przechodzi dalej
  function skip() { results.push({ ok: false, focus: words[idx].focus, skipped: true }); next(); }

  async function next() {
    idx++; attempts = 0;
    if (idx >= words.length) return finish();
    draw();
  }

  async function finish() {
    screen.replaceChildren(el('div.card.center.stack', { style: 'max-width:520px;margin:8vh auto' }, [
      el('div', { style: 'font-size:3rem', text: '🛰️' }),
      el('h2.display', { text: 'Tworzę Twój profil fonetyczny...' }),
      el('p.muted', { text: 'Sprawdzam Twoje mocne strony i wyzwania w wymowie.' }),
    ]));
    const profile = await ai.buildProfile({ results });
    store.setPhoneticProfile(profile);

    const chal = profile.challenges?.length
      ? profile.challenges.join(', ')
      : 'brak — świetna wymowa!';
    setTimeout(() => {
      screen.replaceChildren(el('div.card.center.stack.fade-in', { style: 'max-width:520px;margin:6vh auto;gap:14px' }, [
        el('div', { style: 'font-size:3rem', text: '✅' }),
        el('h2.display', { text: 'Paszport gotowy!' }),
        el('p.muted', { text: 'Izabela wie już, jak brzmisz. Od teraz będzie zwracać uwagę na Twoje słabsze dźwięki.' }),
        el('div.pill', { style: 'margin:0 auto', text: `Do popracowania: ${chal}` }),
        el('div.spacer-sm'),
        el('button.btn.btn--primary.btn--lg', { onclick: () => navigate('#/lessons') }, ['Do lekcji →']),
      ]));
    }, 1200);
  }
}
