import { el, topbar, toast, navigate } from '../ui.js';
import { store } from '../state.js';
import { speech } from '../services/speech.js';
import { ai } from '../services/ai.js';
import { PHONETIC_WORDS } from '../data/phonetic-words.js';

export function renderPhonetic(mount) {
  const words = PHONETIC_WORDS;
  // Prawdziwa analiza audio gdy Gemini podłączony i przeglądarka umie nagrywać
  const audioMode = ai.provider === 'gemini' && speech.canRecord();

  let idx = 0;
  const results = [];          // najlepszy wynik na słowo (po przejściu dalej)
  let best = null;             // najlepszy wynik dla bieżącego słowa
  let phase = 'idle';          // idle | recording | analyzing | result
  let rec = null, recTimer = null, lastSpoken = -1;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const screen = el('div.fade-in');
  mount.append(topbar(), screen);
  draw();

  function speakWord(rate = 0.85) { speech.speak(words[idx].word, { lang: 'en-US', rate }); }

  function dots() {
    return el('div.word-dots', {}, words.map((_, i) =>
      el(`i${i < idx ? '.done' : i === idx ? '.active' : ''}`)));
  }

  function draw() {
    const w = words[idx];
    screen.replaceChildren(
      el('div.center.stack', { style: 'gap:6px;margin-bottom:16px' }, [
        el('div.pill', { style: 'margin:0 auto', text: `🎤 Paszport Fonetyczny · ${idx + 1}/${words.length}` }),
        el('p.muted', { style: 'margin:6px 0 0', text: '1) Posłuchaj, jak Izabela czyta słowo.  2) Powtórz je do mikrofonu.' }),
      ]),
      el('div.card.center.stack', { style: 'max-width:580px;margin:0 auto;gap:14px' }, [
        el('div.phonetic-word', { text: w.word }),
        el('div.phonetic-ipa', { text: w.ipa }),
        el('button.btn.btn--ghost', { style: 'margin:0 auto', onclick: () => speakWord() }, ['🔊 Posłuchaj jeszcze raz']),
        el('div.phonetic-hint', { text: w.hint }),
        el('div.spacer-sm'),
        micArea(),
        resultArea(),
        el('div.row', { style: 'justify-content:center;gap:10px;margin-top:6px' }, [
          el('button.btn.btn--ghost', { onclick: skip }, ['Pomiń słowo']),
        ]),
      ]),
      el('div.spacer'),
      dots(),
    );
    if (!audioMode && !speech.isRecognitionSupported()) {
      setStatus('⚠️ Ta przeglądarka nie wspiera mikrofonu — możesz pomijać słowa.');
    }
    if (phase === 'idle' && lastSpoken !== idx) { lastSpoken = idx; speakWord(); }
  }

  function micArea() {
    if (phase === 'analyzing') {
      return el('div.center.stack', { style: 'gap:8px' }, [
        el('div.spinner'),
        el('div.faint', { text: 'Izabela słucha Twojej wymowy… 👂' }),
      ]);
    }
    const recording = phase === 'recording';
    return el('div.center.stack', { style: 'gap:8px' }, [
      el(`button.mic-btn${recording ? '.recording' : ''}`, { onclick: onMic, 'aria-label': 'Nagraj' }, [recording ? '⏹' : '🎙']),
      el('div.faint', { id: 'phon-status', text: recording ? 'Mów teraz… (dotknij, by zakończyć)' : 'Dotknij i powiedz słowo' }),
    ]);
  }

  function resultArea() {
    if (phase !== 'result' || !best) return el('span');
    const r = best;
    const score = typeof r.score === 'number' ? r.score : null;
    const good = r.ok;
    return el('div.pron-result.fade-in', { style: 'width:100%' }, [
      score != null ? scoreBar(score) : null,
      r.heard ? el('div.muted', { style: 'margin-top:8px', html: `Usłyszałam: „<b>${r.heard}</b>"` }) : null,
      (!good && r.issue) ? el('div.pron-issue', { text: '⚠️ ' + r.issue }) : null,
      r.tip ? el('div', { style: 'margin-top:8px', text: (good ? '✅ ' : '💡 ') + (good ? (r.praise || 'Brzmi świetnie!') : r.tip) }) : null,
      el('div.row', { style: 'justify-content:center;gap:10px;margin-top:14px' }, [
        el('button.btn.btn--ghost', { onclick: () => { phase = 'idle'; draw(); } }, ['↺ Jeszcze raz']),
        el('button.btn.btn--primary', { onclick: next }, ['Dalej →']),
      ]),
    ]);
  }

  function scoreBar(score) {
    const color = score >= 80 ? 'var(--cyan)' : score >= 60 ? 'var(--warn)' : 'var(--error)';
    return el('div.stack', { style: 'gap:6px' }, [
      el('div.row', { style: 'justify-content:space-between' }, [
        el('span.faint', { text: 'Twoja wymowa' }),
        el('span.display', { style: `font-size:1.3rem;color:${color}`, text: score + '%' }),
      ]),
      el('div.score-bar', {}, [el('i', { style: `width:${score}%;background:${color}` })]),
    ]);
  }

  function setStatus(text) { const s = document.getElementById('phon-status'); if (s) s.textContent = text; }

  // ---------- nagrywanie + analiza ----------
  function onMic() {
    if (phase === 'recording') return stopRecording();
    if (phase === 'idle') return startRecording();
  }

  async function startRecording() {
    if (audioMode) {
      try { rec = await speech.recordAudio(); }
      catch (e) { toast('Mikrofon: ' + (e.message || e), 'error'); return; }
      phase = 'recording'; draw();
      recTimer = setTimeout(stopRecording, 4000);   // bezpiecznik
    } else {
      legacyListen();
    }
  }

  async function stopRecording() {
    if (phase !== 'recording' || !rec) return;
    clearTimeout(recTimer);
    phase = 'analyzing'; draw();
    rec.stop();
    const audio = await rec.done; rec = null;
    const w = words[idx];
    let res = await ai.analyzePronunciation({ target: w, base64: audio.base64, mimeType: audio.mimeType });
    if (!res) {
      // Gemini nie ocenił (np. format audio) — łagodnie, nie blokujemy
      res = { ok: true, score: null, heard: '', issue: null, tip: 'Nie udało mi się dokładnie odsłuchać nagrania — ale lecimy dalej!', focus: w.focus, soft: true };
      toast('Nie udało się przeanalizować nagrania (spróbuj ponownie lub pomiń).', 'error');
    }
    if (!best || (res.score ?? 0) >= (best.score ?? 0)) best = res;
    phase = 'result'; draw();
    const line = res.ok ? (res.praise || 'Świetnie!') : (res.tip || '');
    if (line) speech.speak(line, { lang: 'pl-PL' });
  }

  // Fallback bez Gemini: Web Speech (transkrypcja + heurystyka)
  function legacyListen() {
    phase = 'recording'; draw();
    let heard = '';
    rec = speech.listen({
      lang: 'en-US',
      onResult: (t) => { heard = t; setStatus(`Słyszę: „${t}"`); },
      onError: (err) => { toast('Mikrofon: ' + (err.message || err), 'error'); phase = 'idle'; draw(); },
      onEnd: async () => {
        const w = words[idx];
        const r = await ai.analyzeWord({ target: w, heard });
        best = { ok: r.ok, score: r.ok ? 85 : 50, heard, issue: r.ok ? null : 'spróbuj wyraźniej', tip: r.feedback, focus: w.focus };
        phase = 'result'; draw();
        speech.speak(r.ok ? 'Świetnie!' : w.word, { lang: r.ok ? 'pl-PL' : 'en-US' });
      },
    });
  }

  function skip() { best = { ok: false, score: 0, focus: words[idx].focus, skipped: true }; next(); }

  function next() {
    if (best) results.push(best);
    best = null; phase = 'idle'; idx++;
    if (idx >= words.length) return finish();
    draw();
  }

  async function finish() {
    screen.replaceChildren(el('div.card.center.stack', { style: 'max-width:520px;margin:8vh auto' }, [
      el('div.spinner'),
      el('h2.display', { text: 'Tworzę Twój profil fonetyczny…' }),
      el('p.muted', { text: 'Zbieram Twoje mocne strony i dźwięki do podszlifowania.' }),
    ]));
    const profile = await ai.buildProfile({ results });
    store.setPhoneticProfile(profile);

    const chal = profile.challenges?.length ? profile.challenges.slice(0, 4).join(', ') : 'brak — super wymowa!';
    const overall = typeof profile.overall === 'number' ? profile.overall : null;
    setTimeout(() => {
      screen.replaceChildren(el('div.card.center.stack.fade-in', { style: 'max-width:520px;margin:6vh auto;gap:14px' }, [
        el('div', { style: 'font-size:3rem', text: '🛰️' }),
        el('h2.display', { text: 'Paszport gotowy!' }),
        overall != null ? scoreBar(overall) : null,
        el('p.muted', { text: 'Izabela wie już, jak brzmisz. Od teraz będzie zwracać uwagę na Twoje słabsze dźwięki podczas rozmów.' }),
        el('div.pill', { style: 'margin:0 auto', text: `🎯 Do podszlifowania: ${chal}` }),
        el('div.spacer-sm'),
        el('button.btn.btn--primary.btn--lg', { onclick: () => navigate('#/lessons') }, ['Do lekcji →']),
      ]));
    }, 1200);
  }
}
