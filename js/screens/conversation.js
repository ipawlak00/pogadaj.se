import { el, topbar, toast, navigate } from '../ui.js';
import { store } from '../state.js';
import { speech } from '../services/speech.js';
import { ai } from '../services/ai.js';
import { getLesson, SCENES } from '../data/lessons.js';

// Lekcja = sekwencja krótkich ćwiczeń mówienia. Izabela czyta po angielsku,
// tłumaczy na polski, a uczeń powtarza. Gdy nie wychodzi — dzieli na kawałki.
export function renderConversation(mount, lessonId) {
  const lesson = getLesson(lessonId);
  if (!lesson) { navigate('#/lessons'); return; }
  const steps = lesson.steps || [];

  // stan
  let stepIdx = 0;
  let phase = '';                 // 'repeat' | 'word' | 'sentence' | 'chunks'
  let attempts = 0;
  let chunks = [], chunkIdx = 0, chunkDoneCb = null;
  let lastLine = null;
  let listening = false, recorder = null;

  // Tryb prowadzenia: AI (Gemini) gdy podłączony, inaczej proste kroki
  const aiLed = ai.provider === 'gemini';
  const history = [];              // [{role:'user'|'model', text}] dla Gemini
  let busy = false;               // czeka na odpowiedź AI

  const REC_LANG = 'en-US';        // uczeń powtarza po angielsku

  // W lekcji chowamy startowy motyw (pomarańcz + planety) — spójny widok stacji
  document.body.classList.add('in-lesson');
  window.addEventListener('hashchange', () => document.body.classList.remove('in-lesson'), { once: true });

  // ---------- UI: duża scena (lewo) + dialog (prawo) ----------
  const sceneImg = el('img', { id: 'scene-img', alt: 'Izabela', src: 'assets/izabela/izabela-lesson.png' });
  const stageCaption = el('div.stage-caption', { id: 'stage-caption' });
  const stage = el('div.lesson-stage', { title: 'Dotknij, aby powtórzyć' }, [
    sceneImg,
    el('div.stage-name', { text: 'Izabela' }),
    stageCaption,
  ]);
  stage.onclick = () => { if (lastLine) speakLine(lastLine.text, { lang: lastLine.lang, slow: lastLine.slow }); };
  const setMood = () => {};
  const setAvSpeaking = (on) => stage.classList.toggle('speaking', !!on);

  const chatEl = el('div.chat');
  const stepArea = el('div', { id: 'step-area' });
  const progressEl = el('div.faint', { id: 'step-progress', style: 'font-size:.8rem;margin:0 0 4px' });
  const micBtn = el('button.mic-btn', { 'aria-label': 'Mów', onclick: toggleListen }, ['Mów']);
  const micLabel = el('div.faint', { id: 'mic-label', style: 'text-align:center', text: 'Naciśnij mikrofon i powtórz' });
  const suggestRow = el('div.suggest-row', { id: 'suggest-row' });
  const replayBtn = el('button.btn.btn--ghost', { onclick: () => { if (lastLine) speakLine(lastLine.text, { lang: lastLine.lang, slow: lastLine.slow }); } }, ['Powtórz']);
  const skipBtn = el('button.btn.btn--ghost', { onclick: skipTask }, ['Pomiń']);

  let sceneTick = 0;
  function nextScene() {
    if (!SCENES.length) return;
    const path = SCENES[sceneTick % SCENES.length];
    sceneTick++;
    sceneImg.onerror = () => { sceneImg.onerror = null; sceneImg.src = 'assets/izabela/izabela-lesson.png'; };
    sceneImg.src = path;
  }
  function showCaption(text) {
    stageCaption.textContent = text;
    stageCaption.classList.remove('show'); void stageCaption.offsetWidth; stageCaption.classList.add('show');
  }
  nextScene();

  mount.append(
    topbar(el('button.btn.btn--ghost', { onclick: () => navigate('#/lessons') }, ['← Lekcje'])),
    el('div.lesson-view.fade-in', {}, [
      stage,
      el('div.lesson-panel', {}, [
        el('div.row', { style: 'justify-content:space-between;align-items:center' }, [
          el('h2.display', { style: 'margin:0;font-size:1.2rem', text: lesson.title }),
          progressEl,
        ]),
        chatEl,
        stepArea,
        suggestRow,
        el('div.composer', { style: 'flex-direction:column;align-items:center;gap:10px' }, [
          micBtn, micLabel,
          el('div.row', { style: 'gap:10px' }, [replayBtn, skipBtn]),
        ]),
      ]),
    ])
  );

  // Start: AI prowadzi lekcję, albo proste kroki (fallback bez Gemini)
  if (aiLed) {
    progressEl.textContent = 'Lekcja na żywo z Izabelą';
    startAiLesson();
  } else if (lesson.intro) {
    addMessage('izabela', lesson.intro);
    speakLine(lesson.intro, { lang: 'pl', onEnd: startStep });
  } else {
    startStep();
  }

  // ---------- tryb AI (lekcja prowadzona przez Gemini) ----------
  function setBusy(on) {
    busy = on;
    micBtn.disabled = on;
    micBtn.style.opacity = on ? '0.5' : '1';
    if (on) setMicLabel('Izabela myśli…');
    else setMicLabel('Naciśnij mikrofon i mów');
  }

  async function startAiLesson() {
    const topic = lesson.aiTopic || lesson.title;
    history.push({ role: 'user', text: `Rozpocznij lekcję mówienia na temat: "${topic}". Przywitaj się bardzo krótko i od razu naucz pierwszej, prostej frazy (po angielsku w cudzysłowie + znaczenie po polsku + poproś o powtórzenie).` });
    await aiTurn();
  }

  async function aiTurn() {
    setBusy(true);
    const r = await ai.lessonReply(history);
    setBusy(false);
    if (r.unsupported) { startStep(); return; }     // brak Gemini → kroki
    nextScene();           // zmiana scenerii co turę
    history.push({ role: 'model', text: r.say });
    if (r.mistake) setMood('oops');
    addMessage('izabela', r.say);
    speakLine(r.say, { lang: r.lang, onEnd: () => setMood('neutral') });
    renderSuggestions(r.suggestions);
    if (r.done) {
      store.markLessonDone(lesson.id);
      toast('Lekcja ukończona!');
    }
  }

  async function handleAiAnswer(text) {
    history.push({ role: 'user', text });
    await aiTurn();
  }

  // ---------- pomocnicze ----------
  function addMessage(who, text) {
    const node = el(`div.msg.msg--${who}`, {}, [
      el('div.who', { text: who === 'izabela' ? 'Izabela' : 'Ty' }),
      el('div', { text }),
    ]);
    chatEl.append(node);
    chatEl.scrollTop = chatEl.scrollHeight;
  }
  function setSpeaking(on) { setAvSpeaking(on); }
  function setMicLabel(t) { micLabel.textContent = t; }

  // Mówi i zapamiętuje ostatnią kwestię. lang 'pl'|'en'; slow = wolniej.
  function speakLine(text, { lang = 'pl', slow = false, onEnd } = {}) {
    lastLine = { text, lang, slow };
    showCaption(text);
    setSpeaking(true);
    speech.speak(text, { lang: lang === 'en' ? 'en-US' : 'pl-PL', rate: slow ? 0.7 : 1,
      onEnd: () => { setSpeaking(false); onEnd?.(); } });
  }
  function izabelaSay(text, { lang = 'pl', slow = false, mood = 'neutral', onEnd } = {}) {
    setMood(mood);
    addMessage('izabela', text);
    speakLine(text, { lang, slow, onEnd: () => { setMood('neutral'); onEnd?.(); } });
  }
  function renderSuggestions(list) {
    suggestRow.replaceChildren();
    if (!list || !list.length) return;
    suggestRow.append(el('div.suggest-hint', { text: 'Dotknij, by usłyszeć po angielsku:' }));
    suggestRow.append(el('div.suggest-chips', {}, list.slice(0, 4).map((s) =>
      el('button.suggest-chip', { onclick: () => speech.speak(s, { lang: 'en-US' }) }, [s]))));
  }

  const norm = (s) => (s || '').toLowerCase().replace(/[^a-ząćęłńóśźż ]/gi, ' ').replace(/\s+/g, ' ').trim();
  const overlapOf = (heardStr, targetStr) => {
    const heard = norm(heardStr).split(' ');
    const target = norm(targetStr).split(' ').filter(Boolean);
    if (!target.length) return 0;
    return target.filter((w) => heard.includes(w)).length / target.length;
  };
  const wordCount = (s) => norm(s).split(' ').filter(Boolean).length;
  const chunkSentence = (s) => {
    const w = s.split(/\s+/), out = [];
    for (let i = 0; i < w.length; i += 3) out.push(w.slice(i, i + 3).join(' '));
    return out;
  };
  const plainPL = (s) => (s || '').replace(/\*/g, '');

  function setProgress() {
    progressEl.textContent = `Krok ${Math.min(stepIdx + 1, steps.length)} z ${steps.length}`;
  }

  // ---------- silnik kroków ----------
  function startStep() {
    if (stepIdx >= steps.length) return finishLesson();
    attempts = 0; phase = ''; chunks = []; chunkIdx = 0; chunkDoneCb = null;
    setProgress();
    nextScene();           // zmiana scenerii przy każdym kroku
    const step = steps[stepIdx];
    if (step.type === 'say') return startSay(step);
    if (step.type === 'fill') return startFill(step);
    nextStep();
  }
  function nextStep() { stepIdx++; startStep(); }

  // Pomiń bieżące zadanie (do szybkiego przeglądania) — działa w obu trybach.
  function skipTask() {
    if (busy) return;
    speech.stopSpeaking();
    if (listening) resetMic();
    if (aiLed) {
      addMessage('user', 'pomijam');
      history.push({ role: 'user', text: 'Pomińmy to ćwiczenie — przejdź od razu do następnej frazy lub tematu.' });
      return aiTurn();
    }
    if (phase === 'chunks' && chunkDoneCb) return chunkDoneCb();
    nextStep();
  }

  function finishLesson() {
    store.markLessonDone(lesson.id);
    setProgress();
    izabelaSay('To wszystko w tej lekcji — świetna robota! Jesteś coraz lepszy. Do zobaczenia następnym razem!', {
      lang: 'pl', mood: 'happy', onEnd: () => { toast('Lekcja ukończona!'); setTimeout(() => navigate('#/lessons'), 600); },
    });
  }

  // --- krok typu 'say' (powtórz słowo/frazę) ---
  function startSay(step) {
    phase = 'repeat';
    stepArea.replaceChildren(el('div.card.center.stack', { style: 'gap:8px' }, [
      el('div.task-en', { text: step.en }),
      el('div.task-pl', { text: step.pl }),
      el('button.btn.btn--ghost', { style: 'margin:0 auto', onclick: () => speech.speak(step.en, { lang: 'en-US' }) }, ['Posłuchaj po angielsku']),
    ]));
    renderSuggestions([step.en]);
    izabelaSay(`Posłuchaj: „${step.en}". Po polsku to: ${step.pl}. Teraz powtórz za mną: „${step.en}".`, { lang: 'pl', slow: true });
  }

  // --- krok typu 'fill' (powiedz brakujące słowo, potem całe zdanie) ---
  function startFill(step) {
    phase = 'word';
    stepArea.replaceChildren(el('div.card', {}, [
      el('div.muted', { style: 'margin-bottom:8px', text: 'Powiedz brakujące słowo:' }),
      el('div.task-en', { text: step.sentence }),
      el('div.task-pl', {}, plSentence(step.sentencePL, step.answer)),
      el('div.task-opts', {}, step.options.map((o) =>
        el('button.suggest-chip', { onclick: () => speech.speak(`„${o.en}" — ${o.pl}`, { lang: 'pl-PL' }) }, [o.en]))),
      el('button.btn.btn--ghost', { style: 'margin-top:12px', onclick: () => izabelaSay(step.hint, { lang: 'pl' }) }, ['Podpowiedź']),
    ]));
    renderSuggestions([step.answer]);
    izabelaSay(`Posłuchaj zdania: „${step.fullSentence}". Po polsku znaczy to: ${plainPL(step.sentencePL)}. Brakuje jednego słowa — powiedz, które pasuje.`, { lang: 'pl', slow: true });
  }

  function plSentence(s, answer) {
    const m = s.match(/^(.*?)\*(.+?)\*(.*)$/);
    if (!m) return [s];
    return [m[1],
      el('button.task-underline', { title: 'Posłuchaj po angielsku', onclick: () => speech.speak(answer, { lang: 'en-US' }) }, [m[2]]),
      m[3]];
  }

  // --- nauka po kawałku (gdy całość nie wychodzi) ---
  function startChunks(sentence, doneCb) {
    chunks = chunkSentence(sentence); chunkIdx = 0; chunkDoneCb = doneCb; phase = 'chunks';
    izabelaSay(`Dobra, to po kawałku — będzie łatwiej! Powtarzaj za mną. Najpierw: „${chunks[0]}"`, { lang: 'pl', slow: true });
    renderSuggestions([chunks[0]]);
  }
  function handleChunks(text) {
    if (overlapOf(text, chunks[chunkIdx]) >= 0.6) {
      chunkIdx++;
      if (chunkIdx >= chunks.length) {
        izabelaSay('Super, wszystkie kawałki Ci wyszły!', { lang: 'pl', mood: 'happy', onEnd: () => chunkDoneCb && chunkDoneCb() });
      } else {
        izabelaSay(`Świetnie! Teraz: „${chunks[chunkIdx]}"`, { lang: 'pl', slow: true, mood: 'happy' });
        renderSuggestions([chunks[chunkIdx]]);
      }
    } else {
      izabelaSay(`Jeszcze raz, wolniutko za mną: „${chunks[chunkIdx]}"`, { lang: 'pl', slow: true });
    }
  }

  // ---------- obsługa odpowiedzi (mówionej) ----------
  function handleAnswer(text) {
    addMessage('user', text);
    if (aiLed) return handleAiAnswer(text);
    if (phase === 'chunks') return handleChunks(text);
    const step = steps[stepIdx];
    if (step.type === 'say') return handleSay(step, text);
    if (step.type === 'fill') return handleFill(step, text);
  }

  function handleSay(step, text) {
    if (overlapOf(text, step.en) >= 0.6) {
      izabelaSay(`Brawo! „${step.en}" — dokładnie tak!`, { lang: 'pl', mood: 'happy', onEnd: nextStep });
    } else {
      attempts++;
      if (wordCount(step.en) > 2 && attempts >= 1) {
        startChunks(step.en, nextStep);
      } else {
        izabelaSay(`Spokojnie Posłuchaj wolniutko: „${step.en}". Spróbuj jeszcze raz za mną.`, { lang: 'pl', slow: true, mood: 'oops' });
      }
    }
  }

  function handleFill(step, text) {
    if (phase === 'word') {
      if (norm(text).split(' ').includes(norm(step.answer))) {
        phase = 'sentence';
        izabelaSay(`Ekstra! Dokładnie — „${step.answer}". A teraz całe zdanie za mną, wolniutko: „${step.fullSentence}"`, { lang: 'pl', slow: true, mood: 'happy' });
        renderSuggestions([step.fullSentence]);
      } else {
        attempts++;
        izabelaSay(attempts >= 2
          ? `Powolutku — posłuchaj: „${step.answer}". ${step.hint} Teraz Ty, samo to słowo.`
          : `Jeszcze nie to ${step.hint}`, { lang: 'pl', slow: attempts >= 2, mood: 'oops' });
      }
    } else if (phase === 'sentence') {
      if (overlapOf(text, step.fullSentence) >= 0.6) {
        izabelaSay('Brawo! Całe zdanie, super Ci poszło!', { lang: 'pl', mood: 'happy', onEnd: nextStep });
      } else {
        startChunks(step.fullSentence, nextStep);
      }
    }
  }

  // ---------- mikrofon (tylko mówienie) ----------
  function toggleListen() {
    if (busy) return;
    if (listening) { recorder?.stop(); return; }
    listening = true; micBtn.classList.add('recording'); micBtn.textContent = 'Stop'; setMicLabel('Słucham… mów teraz');
    let heard = '';
    recorder = speech.listen({
      lang: REC_LANG,
      onResult: (t) => { heard = t; setMicLabel(`„${t}"`); },
      onError: (e) => { toast('Mikrofon: ' + (e.message || e), 'error'); resetMic(); },
      onEnd: () => { resetMic(); if (heard) handleAnswer(heard); else setMicLabel('Nie dosłyszałam — naciśnij i powiedz jeszcze raz'); },
    });
  }
  function resetMic() { listening = false; micBtn.classList.remove('recording'); micBtn.textContent = 'Mów'; setMicLabel('Naciśnij mikrofon i powtórz'); }
}
