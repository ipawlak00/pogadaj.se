import { el, topbar, toast, navigate, feedbackCorner } from '../ui.js';
import { store } from '../state.js';
import { speech, splitSentences } from '../services/speech.js';
import { ai } from '../services/ai.js';
import { auth } from '../services/auth.js';
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
      // klik w dymek = Izabela powtarza to, co właśnie mówi
      el('div.iza-card__bubble', { id: 'iza-bubble', text: izaLine,
        title: 'Kliknij, a powtórzę', style: 'cursor:pointer',
        onclick: () => speech.speak(izaLine, { lang: 'pl-PL' }) }),
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
          el('div.phon-count', { text: `${idx + 1}/${words.length} słówek` }),
          resultArea(),
          el('div.row', { style: 'justify-content:center;gap:10px;margin-top:6px' }, [
            el('button.btn.btn--sq', { onclick: skip }, ['Pomiń słowo']),
            el('button.btn.btn--sq', { onclick: skipAll }, ['Pomiń cały test']),
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
        // Dymek zmienia się AUTOMATYCZNIE w rytm mowy — pokazuje aktualne
        // zdanie, a po całości czytamy pierwsze słowo.
        const intro = splitSentences(INTRO);
        izaLine = intro[0];
        const bb0 = document.getElementById('iza-bubble'); if (bb0) bb0.textContent = intro[0];
        speech.speakSequence(intro, {
          lang: 'pl-PL',
          onPart: (t) => { izaLine = t; const b = document.getElementById('iza-bubble'); if (b) b.textContent = t; },
          onDone: () => speakWord(),
        });
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
      el('div.faint', { id: 'phon-status', text: '' }),
    ]);
  }

  function resultArea() {
    if (phase !== 'result' || !best) return el('span');
    const r = best;
    const good = r.ok;
    // Bez procentów — ocena liczbowa tylko stresuje. Liczy się wskazówka.
    return el('div.pron-result.fade-in', { style: 'width:100%' }, [
      r.heard ? el('div.muted', { style: 'margin-top:8px', html: `Usłyszałam: „<b>${r.heard}</b>"` }) : null,
      r.tip ? el('div', { style: 'margin-top:8px', text: good ? (r.praise || 'Brzmi świetnie!') : r.tip }) : null,
      el('div.row', { style: 'justify-content:center;gap:10px;margin-top:14px' }, [
        el('button.btn.btn--primary.btn--lg', { onclick: next, style: 'color:#fff' }, ['Dalej']),
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
    // po wyniku też można nagrać jeszcze raz — mikrofon zastępuje przycisk „Jeszcze raz"
    if (phase === 'idle' || phase === 'result') return startRecording();
  }

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
    // Żadnych mówionych zajawek („sekundka") — spinner wystarczy,
    // Izabela odzywa się dopiero z gotową odpowiedzią i nie przerywa sama sobie.
    phase = 'analyzing'; draw();
    rec.stop();
    const audio = await rec.done; rec = null;
    const w = words[idx];
    let res = await ai.analyzePronunciation({ target: w, base64: audio.base64, mimeType: audio.mimeType });
    if (!res) {
      // Gemini nie ocenił (np. format audio) — łagodnie, nie blokujemy
      res = { ok: true, score: null, heard: '', issue: null, tip: 'Nie udało mi się dokładnie odsłuchać nagrania, ale lecimy dalej!', focus: w.focus, soft: true };
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

  // „Pomiń cały test" — uczeń nie chce teraz robić testu. Bez udawania analizy:
  // ciepła reakcja, oznaczamy jako pominięty (zrobi go później w lekcji) i dalej.
  function skipAll() {
    speech.stopSpeaking();
    store.patchKey('phonetic', { completed: true, skipped: true, profile: null });
    store.patchKey('progress', { fullUnlocked: true });
    auth.saveProfile({ skipped: true }).catch(() => {});
    const line = 'No dobra, jak nie chcesz teraz gadać, to nie będę Cię ciągnąć za język! ' +
      'Twoją wymowę sprawdzimy sobie później — w trakcie lekcji po prostu powiedz „zróbmy test wymowy", a od razu go odpalę. Lecimy!';
    screen.replaceChildren(el('div.card.center.stack', { style: 'max-width:520px;margin:10vh auto' }, [
      el('h2.display', { style: 'color:#14314f', text: 'Spoko, zrobimy to później' }),
      el('p.muted', { style: 'font-size:1.05rem;line-height:1.6', text: line }),
      el('button.btn.btn--primary.btn--lg', { style: 'color:#fff', onclick: () => navigate('#/home') }, ['Wchodzę na pokład']),
    ]));
    speech.speak(line, { lang: 'pl-PL', onEnd: (e) => { if (!e?.cancelled) navigate('#/home'); } });
    setTimeout(() => { if (location.hash.includes('phonetic')) navigate('#/home'); }, 8000);
  }

  function next() {
    if (best) { best.word = words[idx].word; results.push(best); }
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
    // Zapis profilu do bazy (Firestore) — Izabela pamięta problemy z wymową
    // między urządzeniami i sesjami, nie tylko w localStorage.
    auth.saveProfile(profile).catch(() => {});

    // Przykładowe słowo dla każdego dźwięku (do "popracujemy nad...")
    const example = {};
    words.forEach((w) => { if (!example[w.focus]) example[w.focus] = w.word; });
    const chalList = (profile.challenges || []).slice(0, 4);
    const chalSpoken = chalList.map((c) => example[c] ? `${c}, jak w „${example[c]}"` : c);

    const hello = pick([
      'Mam Cię!',
      'No i cyk, mam Cię rozgryzioną!',
      'Misja zakończona, paszport wbity!',
      'Cyk myk i po sprawie!',
      'Ale farcik, przesłuchane w całości!',
      'Mocne! Dobra robota z tym testem!',
      'No to pozamiatane, znam Twój akcent!',
    ]);
    const challengeLine = chalList.length
      ? `Na celowniku mamy: ${chalSpoken.join(', ')}. Będę Cię na tym łapać podczas gadania, oczywiście z miłością.`
      : '';
    // Wypowiedź jest podzielona na części — dymek zmienia się w trakcie mówienia,
    // pokazując aktualnie wypowiadaną kwestię. Puste części pomijamy.
    const parts = [
      `${hello} Znam już Twoją wymowę od podszewki i wiem, nad czym możemy razem popracować.`,
      challengeLine,
      'A zanim ruszymy dalej, mam do Ciebie jedno pytanie.',
      'Powiedz mi albo napisz, co Tobie sprawia największą trudność w mówieniu po angielsku. Może czasy, może brakuje Ci słówek, a może stres, że powiesz coś źle?',
      'Zapamiętam to i będziemy nad tym pracować razem, spokojnie, krok po kroku.',
    ].filter(Boolean);
    izaLine = parts[0];

    function setBubble(t) { const b = document.getElementById('iza-bubble'); if (b) b.textContent = t; }
    // Mówi po kolei, a dymek pokazuje aktualną kwestię (zmienia się w trakcie)
    function speakParts(list, i) {
      if (i >= list.length) return;
      izaLine = list[i]; setBubble(list[i]);
      speech.speak(list[i], { lang: 'pl-PL', onEnd: (e) => { if (!e?.cancelled) speakParts(list, i + 1); } });
    }
    const diffArea = el('textarea.feedback-text', {
      style: 'min-height:84px',
      placeholder: 'Np. czasy przeszłe, rozumienie ze słuchu, stres przy mówieniu…',
      maxlength: '500',
    });
    const diffStatus = el('div.faint', { style: 'min-height:1.2em', text: '' });
    let recD = null;

    async function diffMic() {
      if (recD) { recD.stop(); return; }   // ręczny Stop — nagranie dokończy się niżej
      if (!audioMode) { toast('Mikrofon niedostępny w tej przeglądarce. Wpisz tekst.', 'error'); return; }
      try {
        recD = await speech.recordAudio({ autoStop: true, silenceMs: 1500, maxMs: 20000 });
      } catch (e) { toast('Mikrofon: ' + (e.message || e), 'error'); return; }
      diffMicBtn.classList.add('recording'); diffMicBtn.textContent = 'Stop';
      diffStatus.textContent = '';
      const audio = await recD.done;   // koniec ręczny albo po ciszy
      recD = null;
      diffMicBtn.classList.remove('recording'); diffMicBtn.textContent = 'Powiedz';
      diffStatus.textContent = 'Przesłuchuję…';
      const text = await ai.transcribe({ base64: audio.base64, mimeType: audio.mimeType });
      diffStatus.textContent = '';
      if (text) diffArea.value = diffArea.value ? diffArea.value + ' ' + text : text;
      else diffStatus.textContent = 'Nie dosłyszałam. Spróbuj jeszcze raz albo wpisz.';
    }
    const diffMicBtn = el('button.btn.btn--sq', { onclick: diffMic }, ['Powiedz']);

    let diffSaved = false;
    function saveDifficulty() {
      const text = diffArea.value.trim().slice(0, 500);
      if (!text || diffSaved) return false;
      diffSaved = true;
      const prof = { ...store.get().phonetic.profile, selfReported: text };
      store.setPhoneticProfile(prof);
      auth.saveProfile(prof).catch(() => {});
      return true;
    }

    function go() {
      // Trial schowany — po teście od razu na statek (pełna wersja, 15 h).
      store.patchKey('progress', { fullUnlocked: true });
      const saved = saveDifficulty();
      if (saved) {
        izaSay(pick([
          'Zanotowane. Będę o tym pamiętać przy każdej naszej rozmowie. No to gadamy!',
          'Dzięki, że mi to mówisz. Właśnie to zapisałam i wezmę pod lupę.',
          'Rozumiem Cię doskonale. Mam to zapisane, popracujemy nad tym razem.',
        ]));
        setTimeout(() => navigate('#/home'), 2600);
      } else {
        navigate('#/home');
      }
    }

    // ---- ekran: białe „sklejenie" ze zdjęciem, jak inne sceny (iza-card) ----
    screen.replaceChildren(
      el('div.iza-card.fade-in', {}, [
        el('div.iza-card__stage', {}, [
          el('img', { src: 'assets/scenes/scene-09.jpg', alt: 'Izabela',
            onerror: function () { this.onerror = null; this.src = 'assets/izabela/izabela-lesson.png'; } }),
          el('div.iza-card__bubble', { id: 'iza-bubble', text: parts[0],
            title: 'Kliknij, a powtórzę', style: 'cursor:pointer',
            onclick: () => speakParts(parts, 0) }),
        ]),
        el('div.iza-card__main', { style: 'gap:10px;display:flex;flex-direction:column;justify-content:center' }, [
          // to, co mówi Izabela, jest w dymku — tu tylko konkrety bez powtórek
          chalList.length
            ? el('div', {}, [
                el('div.passport-bubble__label', { text: 'Popracujemy nad:' }),
                el('div.passport-chips', {}, chalSpoken.map((c) => el('span.passport-chip', { text: c }))),
              ])
            : null,
          el('div', { style: 'border-top:1px solid #dce9f5;margin:6px 0' }),
          el('p', { style: 'margin:0;color:#14314f;font-weight:700', text: 'A co Tobie sprawia największą trudność w mówieniu po angielsku?' }),
          el('p', { style: 'margin:0;color:#46688c;font-size:.9rem', text: 'Powiedz mi to albo napisz. Zapamiętam i będziemy nad tym pracować.' }),
          diffArea,
          el('div.row', { style: 'gap:10px;flex-wrap:wrap;align-items:center' }, [
            diffMicBtn,
            diffStatus,
          ]),
          el('button.btn.btn--primary.btn--lg', { style: 'align-self:flex-start', onclick: go }, ['Gadamy!']),
        ]),
      ]),
    );
    speakParts(parts, 0);
  }
}
