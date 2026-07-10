import { el, topbar, toast, navigate, feedbackCorner } from '../ui.js';
import { store } from '../state.js';
import { speech } from '../services/speech.js';
import { ai } from '../services/ai.js';
import { PHONETIC_WORDS } from '../data/phonetic-words.js';

export function renderPhonetic(mount) {
  const words = PHONETIC_WORDS.slice(0, 12);   // 12 słówek wystarczy, 20 męczyło
  // Prawdziwa analiza audio gdy Gemini podłączony i przeglądarka umie nagrywać
  const audioMode = ai.provider === 'gemini' && speech.canRecord();

  let idx = 0;
  const results = [];          // najlepszy wynik na słowo (po przejściu dalej)
  let best = null;             // najlepszy wynik dla bieżącego słowa
  let phase = 'idle';          // idle | recording | analyzing | result
  let rec = null, recTimer = null, lastSpoken = -1;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // Izabela najpierw tłumaczy, PO CO ten cały paszport — bez tego to tylko test
  let introSpoken = false;
  const selfOops = pick(['sama często kaleczę', 'sama robię błędy', 'samej często mi się myli', 'sama się czasem mieszam']);
  const INTRO = 'Zanim zaczniemy, wyjaśnię o co mi chodzi. Chcę usłyszeć, jaki masz akcent, ' +
    'żeby lepiej rozumieć Twoje wypowiedzi. Każdy z nas mówi trochę inaczej i nie ma się czego wstydzić. ' +
    'Przy mnie nie masz czego się bać, ja ' + selfOops + ', ale nigdy się nie poddaję! ' +
    'Powtórz za mną kilka słów i tyle.';

  // Dymek pod Izabelą pokazuje to, co właśnie mówi (nie statyczny tekst)
  let izaLine = 'Chcę usłyszeć, jaki masz akcent, żeby lepiej Cię rozumieć. Każdy mówi trochę inaczej i nie ma się czego wstydzić!';
  function izaSay(text) {
    izaLine = text;
    const b = document.getElementById('iza-bubble');
    if (b) b.textContent = text;
    speech.speak(text, { lang: 'pl-PL' });
  }

  const screen = el('div.fade-in');
  mount.append(topbar(), screen, feedbackCorner('test fonetyczny'));
  draw();

  function speakWord(rate = 0.85) { speech.speak(words[idx].word, { lang: 'en-US', rate }); }

  function dots() {
    return el('div.word-dots', {}, words.map((_, i) =>
      el(`i${i < idx ? '.done' : i === idx ? '.active' : ''}`)));
  }

  function draw() {
    const w = words[idx];
    // Jedna sklejona karta: Izabela (z dymkiem) po lewej, test po prawej
    const izaSide = el('div.iza-card__stage', {}, [
      el('img', { src: 'assets/scenes/scene-05.jpg', alt: 'Izabela',
        onerror: function () { this.onerror = null; this.src = 'assets/izabela/izabela-lesson.png'; } }),
      el('div.iza-card__bubble', { id: 'iza-bubble', text: izaLine }),
    ]);
    screen.replaceChildren(
      el('div.iza-card.fade-in', {}, [
        izaSide,
        el('div.iza-card__main.center', { style: 'gap:12px' }, [
          el('p.muted', { style: 'margin:0', text: '1) Posłuchaj, jak czytam słowo.  2) Powtórz je do mikrofonu.' }),
          el('div.phonetic-word', { text: w.word }),
          el('div.phonetic-ipa', { text: w.ipa }),
          el('div.phonetic-pl', { text: w.pl }),
          el('button.btn.btn--sq', { style: 'margin:0 auto', onclick: () => speakWord() }, ['Posłuchaj jeszcze raz']),
          el('div.phonetic-hint', { text: w.hint }),
          el('div.spacer-sm'),
          micArea(),
          el('div.faint', { style: 'font-size:.85rem', text: `${idx + 1}/${words.length} słówek` }),
          resultArea(),
          el('div.row', { style: 'justify-content:center;gap:10px;margin-top:6px' }, [
            el('button.btn.btn--sq', { onclick: skip }, ['Pomiń słowo']),
            el('button.btn.btn--sq', { onclick: finish }, ['Pomiń cały test']),
          ]),
          dots(),
        ]),
      ]),
    );
    if (!audioMode && !speech.isRecognitionSupported()) {
      setStatus('Ta przeglądarka nie wspiera mikrofonu — możesz pomijać słowa.');
    }
    if (phase === 'idle' && lastSpoken !== idx) {
      lastSpoken = idx;
      if (!introSpoken) {
        introSpoken = true;
        izaLine = INTRO;
        const bb = document.getElementById('iza-bubble'); if (bb) bb.textContent = INTRO;
        speech.speak(INTRO, { lang: 'pl-PL', onEnd: () => speakWord() });
      }
      else speakWord();
    }
  }

  function micArea() {
    if (phase === 'analyzing') {
      return el('div.center.stack', { style: 'gap:8px' }, [
        el('div.spinner'),
        el('div.faint', { text: 'Izabela słucha Twojej wymowy…' }),
      ]);
    }
    const recording = phase === 'recording';
    return el('div.center.stack', { style: 'gap:8px' }, [
      el(`button.mic-btn${recording ? '.recording' : ''}`, { onclick: onMic, 'aria-label': 'Nagraj' }, [recording ? 'Stop' : 'Mów']),
      el('div.faint', { id: 'phon-status', text: recording ? 'Mów teraz… (dotknij, by zakończyć)' : 'Dotknij i powiedz słowo' }),
    ]);
  }

  function resultArea() {
    if (phase !== 'result' || !best) return el('span');
    const r = best;
    const good = r.ok;
    // Bez procentów — ocena liczbowa tylko stresuje. Liczy się wskazówka.
    return el('div.pron-result.fade-in', { style: 'width:100%' }, [
      r.heard ? el('div.muted', { style: 'margin-top:8px', html: `Usłyszałam: „<b>${r.heard}</b>"` }) : null,
      (!good && r.issue) ? el('div.pron-issue', { text: '' + r.issue }) : null,
      r.tip ? el('div', { style: 'margin-top:8px', text: (good ? '' : '') + (good ? (r.praise || 'Brzmi świetnie!') : r.tip) }) : null,
      el('div.row', { style: 'justify-content:center;gap:10px;margin-top:14px' }, [
        el('button.btn.btn--ghost', { onclick: () => { phase = 'idle'; draw(); } }, ['Jeszcze raz']),
        el('button.btn.btn--primary', { onclick: next }, ['Dalej']),
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

  // Krótkie zajawki mówione od razu po nagraniu — uczeń wie, że coś się dzieje.
  // (Cache'ują się po pierwszym użyciu, więc grają natychmiast.)
  const FILLERS = ['Mhm, sekundka...', 'Okej, przesłuchuję...', 'Już słucham, momencik...', 'Dobra, lecę z odsłuchem...'];

  async function startRecording() {
    if (audioMode) {
      // Auto-stop po ciszy — wystarczy powiedzieć słowo, nagranie samo się kończy
      try { rec = await speech.recordAudio({ autoStop: true, silenceMs: 1000, maxMs: 6000, onStop: () => { if (phase === 'recording') stopRecording(); } }); }
      catch (e) { toast('Mikrofon: ' + (e.message || e), 'error'); return; }
      phase = 'recording'; draw();
    } else {
      legacyListen();
    }
  }

  async function stopRecording() {
    if (phase !== 'recording' || !rec) return;
    clearTimeout(recTimer);
    phase = 'analyzing'; draw();
    izaSay(pick(FILLERS));   // natychmiastowa reakcja głosem (i w dymku)
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
    const line = res.ok
      ? (res.praise || pick(['Mocne!', 'No i git!', 'Cyk myk i zrobione!', 'Ale farcik, czysto poszło!']))
      : (res.tip || '');
    if (line) izaSay(line);
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
      el('h2.display', { text: 'Chwila, składam Twój paszport…' }),
      el('p.muted', { text: 'Przesłuchuję wszystko jeszcze raz i notuję.' }),
    ]));
    const profile = await ai.buildProfile({ results });
    store.setPhoneticProfile(profile);

    // Przykładowe słowo dla każdego dźwięku (do "popracujemy nad...")
    const example = {};
    words.forEach((w) => { if (!example[w.focus]) example[w.focus] = w.word; });
    const chalList = (profile.challenges || []).slice(0, 4);
    const chalSpoken = chalList.map((c) => example[c] ? `${c} — jak w „${example[c]}"` : c);

    const hello = pick([
      'No i cyk, mam Cię rozgryzioną!',
      'Misja zakończona, paszport wbity!',
      'Cyk myk i po sprawie!',
      'Ale farcik, przesłuchane w całości!',
      'Mocne! Dobra robota z tym testem!',
      'No to pozamiatane, znam Twój akcent!',
    ]);
    const challengeLine = chalList.length
      ? `Na celowniku mamy: ${chalSpoken.join(', ')}. Będę Cię na tym łapać podczas gadania — z miłością, rzecz jasna.`
      : 'I szczerze? Nie mam się do czego przyczepić. Aż podejrzane...';
    // Bez procentów — zero stresu, tylko konkret nad czym popracujemy
    const spokenAll = `${hello} Znam już Twoją wymowę od podszewki. ${challengeLine} Dobra, dawaj — pogadamy w końcu!`;

    // Izabela na zdjęciu + dymek od jej ust z tym, co właśnie mówi
    screen.replaceChildren(el('div.passport-scene.fade-in', {}, [
      el('div.passport-iza-wrap', {}, [el('img.passport-iza', { src: 'assets/scenes/scene-09.jpg', alt: 'Izabela' })]),
      el('div.passport-bubble', {}, [
        el('div.passport-bubble__title', { text: hello }),
        el('p', { style: 'margin:10px 0 0', text: 'Znam już Twoją wymowę od podszewki.' }),
        chalList.length
          ? el('div', { style: 'margin-top:8px' }, [
              el('div.passport-bubble__label', { text: 'Popracujemy nad:' }),
              el('div.passport-chips', {}, chalSpoken.map((c) => el('span.passport-chip', { text: c }))),
            ])
          : el('p', { style: 'margin-top:8px', text: 'Nie mam się do czego przyczepić. Aż podejrzane...' }),
        el('div.spacer-sm'),
        el('button.btn.btn--primary.btn--lg', { onclick: () => navigate('#/lessons') }, ['Gadamy!']),
      ]),
    ]));
    speech.speak(spokenAll, { lang: 'pl-PL' });
  }
}
