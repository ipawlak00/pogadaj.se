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

  const screen = el('div.fade-in');
  mount.append(topbar(), screen);
  draw();

  function dots() {
    return el('div.word-dots', {}, words.map((_, i) =>
      el(`i${i < idx ? '.done' : i === idx ? '.active' : ''}`)));
  }

  function draw() {
    const w = words[idx];
    screen.replaceChildren(
      el('div.center.stack', { style: 'gap:6px;margin-bottom:18px' }, [
        el('div.pill', { style: 'margin:0 auto', text: `🎤 Paszport Fonetyczny · ${idx + 1}/${words.length}` }),
        el('p.muted', { style: 'margin:6px 0 0', text: 'Przeczytaj słowo na głos. Izabela dostroi się do Twojej wymowy.' }),
      ]),
      el('div.card.center.stack', { style: 'max-width:560px;margin:0 auto;gap:14px' }, [
        el('div.phonetic-word', { text: w.word }),
        el('div.phonetic-ipa', { text: w.ipa }),
        el('div.phonetic-hint', { text: w.hint }),
        el('div.spacer-sm'),
        el(`button.mic-btn${recording ? '.recording' : ''}`, { onclick: toggleRec, 'aria-label': 'Nagraj' }, [recording ? '⏹' : '🎙']),
        el('div.faint', { id: 'phon-status', text: recording ? 'Słucham... powiedz słowo' : 'Dotknij i przeczytaj' }),
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
  }

  function setStatus(text) { const s = document.getElementById('phon-status'); if (s) s.textContent = text; }

  function toggleRec() {
    if (recording) { recorder?.stop(); return; }
    recording = true; draw();
    let heard = '';
    recorder = speech.listen({
      onResult: (text) => { heard = text; setStatus(`Słyszę: „${text}"`); },
      onError: (err) => { toast('Mikrofon: ' + (err.message || err), 'error'); recording = false; draw(); },
      onEnd: async () => {
        recording = false;
        const w = words[idx];
        const res = await ai.analyzeWord({ target: w, heard });
        results.push(res);
        toast(res.feedback, res.ok ? '' : 'error');
        next();
      },
    });
  }

  function skip() { results.push({ ok: false, focus: words[idx].focus, skipped: true }); next(); }

  async function next() {
    idx++;
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
