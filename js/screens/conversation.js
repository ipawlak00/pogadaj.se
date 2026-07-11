import { el, topbar, toast, navigate } from '../ui.js';
import { store } from '../state.js';
import { speech, isEnglishText } from '../services/speech.js';
import { ai } from '../services/ai.js';
import { getLesson, getTrialLesson, getFullLesson, SCENES, TRIAL_MINUTES, FULL_MONTH_MINUTES, LESSON_PORTRAITS } from '../data/lessons.js';
import { lessonHello } from '../data/phrases.js';

// Lekcja = rozmowa z Izabelą (AI) albo sekwencja prostych kroków (bez AI).
export function renderConversation(mount, lessonId) {
  const lesson = lessonId === 'trial'
    ? getTrialLesson(store.get().onboarding.level)
    : (lessonId === 'full' ? getFullLesson(store.get().onboarding.level) : getLesson(lessonId));
  if (!lesson) { navigate('#/lessons'); return; }
  const steps = lesson.steps || [];

  // Budżety czasu: trial 45 min łącznie; pełna wersja 15 h / miesiąc.
  const isTrial = lesson.id === 'trial';
  const isFull = lesson.id === 'full';
  if (isTrial && (store.get().progress.trialSecondsUsed || 0) >= TRIAL_MINUTES * 60) {
    navigate('#/lessons'); return;
  }
  if (isFull) {
    // miesięczny reset budżetu
    const mk = new Date().toISOString().slice(0, 7);
    if (store.get().progress.fullMonth !== mk) {
      store.patchKey('progress', { fullMonth: mk, fullSecondsUsed: 0 });
    }
    if ((store.get().progress.fullSecondsUsed || 0) >= FULL_MONTH_MINUTES * 60) {
      navigate('#/home'); return;
    }
    // wpis w historii dla bieżącej sesji pełnej wersji
    if (!store.get().progress.currentFullId) {
      const id = 'full-' + Date.now();
      const history = store.get().progress.history || [];
      history.push({ id, kind: 'full', startedAt: Date.now(), seconds: 0, summary: '' });
      store.patchKey('progress', { currentFullId: id, history });
    }
  }
  if (isTrial) {
    // lekcja próbna widnieje w historii od pierwszego wejścia
    const history = store.get().progress.history || [];
    if (!history.find((h) => h.id === 'trial')) {
      history.unshift({ id: 'trial', kind: 'trial', startedAt: Date.now(), seconds: 0, summary: '' });
      store.patchKey('progress', { history });
    }
  }

  // stan
  let stepIdx = 0;
  let phase = '';                 // 'repeat' | 'word' | 'sentence' | 'chunks'
  let attempts = 0;
  let chunks = [], chunkIdx = 0, chunkDoneCb = null;
  let lastLine = null;
  let listening = false, recorder = null, recHandle = null, processing = false;
  let chatLog = [];               // widoczne dymki (do wznowienia lekcji po przerwie)

  // Tryb prowadzenia: AI (Gemini) gdy podłączony, inaczej proste kroki
  const aiLed = ai.provider === 'gemini';
  const history = [];              // [{role:'user'|'model', text}] dla Gemini
  let busy = false;               // czeka na odpowiedź AI
  let introGate = Promise.resolve();   // powitanie ma się wybrzmieć przed 1. odpowiedzią AI

  // Mowa ucznia: gdy jest Gemini, nagrywamy audio i transkrybujemy (łapie MIKS PL+EN).
  // Bez Gemini — zapasowo rozpoznawanie przeglądarki (jeden język).
  const useGeminiStt = aiLed && speech.canRecord();
  const FALLBACK_REC_LANG = 'pl-PL';   // tylko gdy brak Gemini

  // W lekcji chowamy startowy motyw (pomarańcz + planety) — spójny widok stacji
  document.body.classList.add('in-lesson');
  // Wyjście z lekcji = natychmiastowa cisza (Izabela nie gada w tle)
  window.addEventListener('hashchange', () => {
    document.body.classList.remove('in-lesson');
    speech.stopSpeaking();
    if (meter) clearInterval(meter);
    if ((isTrial || isFull) && !trialEnded) updateHistoryOnExit();
    try { recHandle?.stop(); recorder?.stop(); } catch (e) { /* ignore */ }
  }, { once: true });

  // Licznik czasu (co 5 s, tylko gdy karta widoczna): trial i pełna wersja
  let meter = null;
  let trialEnded = false;
  let sessionSeconds = 0;                      // czas TEJ wizyty (do historii)
  if (isTrial) {
    meter = setInterval(() => {
      if (document.hidden || trialEnded) return;
      sessionSeconds += 5;
      const used = (store.get().progress.trialSecondsUsed || 0) + 5;
      store.patchKey('progress', { trialSecondsUsed: used });
      if (used >= TRIAL_MINUTES * 60) {
        trialEnded = true;
        clearInterval(meter);
        speech.stopSpeaking();
        updateHistoryOnExit();
        clearLessonMemory();
        micBtn.disabled = true; micBtn.style.opacity = '0.5';
        izabelaSay('No i cyk, wykorzystaliśmy cały czas próbny! Było mi mega miło. Zobacz, co dla Ciebie mam!', {
          lang: 'pl', onEnd: () => navigate('#/lessons'),
        });
      }
    }, 5000);
  }
  if (isFull) {
    meter = setInterval(() => {
      if (document.hidden || trialEnded) return;
      sessionSeconds += 5;
      const used = (store.get().progress.fullSecondsUsed || 0) + 5;
      store.patchKey('progress', { fullSecondsUsed: used });
      if (used >= FULL_MONTH_MINUTES * 60) {
        trialEnded = true;
        clearInterval(meter);
        speech.stopSpeaking();
        updateHistoryOnExit();
        micBtn.disabled = true; micBtn.style.opacity = '0.5';
        izabelaSay('Wow, wygadaliśmy cały miesięczny czas! Szanuję. Widzimy się od nowego miesiąca!', {
          lang: 'pl', onEnd: () => navigate('#/home'),
        });
      }
    }, 5000);
  }

  // Historia: dopisz czas tej wizyty i (w tle) krótkie streszczenie rozmowy
  function updateHistoryOnExit() {
    const p = store.get().progress;
    const history = p.history || [];
    const id = isTrial ? 'trial' : p.currentFullId;
    const entry = history.find((h) => h.id === id);
    if (!entry) return;
    entry.seconds = isTrial ? (p.trialSecondsUsed || 0) : (entry.seconds + sessionSeconds);
    store.patchKey('progress', { history });
    const talk = chatLog.slice(-12).map((m) => `${m.who === 'izabela' ? 'Izabela' : 'Uczeń'}: ${m.text}`).join('\n');
    if (talk.length > 40) {
      ai.summarizeLesson(talk).then((sum) => {
        if (!sum) return;
        const p2 = store.get().progress;
        const h2 = p2.history || [];
        const e2 = h2.find((h) => h.id === id);
        if (e2) { e2.summary = sum; store.patchKey('progress', { history: h2 }); }
      }).catch(() => {});
    }
  }

  // ---------- UI: jedna karta czatu — Izabela (lewo) + rozmowa (prawo) ----------
  // Dymki Izabeli "wychodzą" od niej w prawo, pod spodem odpowiedzi ucznia.
  // Całość przewijalna — można wrócić do wcześniejszych wiadomości.
  const sceneImg = el('img', { id: 'scene-img', alt: 'Izabela', src: 'assets/izabela/izabela-lesson.png' });
  const stage = el('div.lc-stage', { title: 'Dotknij, aby powtórzyć' }, [sceneImg]);
  stage.onclick = () => { if (lastLine) speakLine(lastLine.text, { lang: lastLine.lang, slow: lastLine.slow }); };
  const setMood = () => {};
  const setAvSpeaking = (on) => stage.classList.toggle('speaking', !!on);

  const chatEl = el('div.chat');
  const stepArea = el('div', { id: 'step-area' });
  const progressEl = el('div.faint', { id: 'step-progress', style: 'font-size:.8rem;margin:0 0 4px' });
  const micBtn = el('button.mic-btn', { 'aria-label': 'Mów', onclick: toggleListen }, ['Mów']);
  const micLabel = el('div.faint', { id: 'mic-label', style: 'text-align:center;min-height:1.2em', text: '' });
  // Co uczeń ma teraz powiedzieć — klik odtwarza wzór jeszcze raz
  const targetEl = el('div.say-target', { id: 'say-target' });
  const replayBtn = el('button.btn.btn--ghost', { onclick: () => { if (lastLine) speakLine(lastLine.text, { lang: lastLine.lang, slow: lastLine.slow }); } }, ['Powtórz']);
  const stopBtn = el('button.btn.btn--ghost', { onclick: () => { speech.stopSpeaking(); setSpeaking(false); } }, ['Przerwij']);

  function setTarget(phrase) {
    targetEl.replaceChildren();
    if (!phrase) return;
    targetEl.append(
      el('span.say-target__label', { text: 'Powtórz:' }),
      el('button.say-target__phrase', {
        title: 'Kliknij, a przeczytam jeszcze raz',
        onclick: () => speech.speak(phrase, { lang: 'en-US', rate: 0.85 }),
      }, [phrase]),
    );
  }
  // Wyciąga z wypowiedzi Izabeli AKTUALNĄ frazę do powtórzenia:
  // ostatni ANGIELSKI cytat (wspólna detekcja języka z silnikiem mowy).
  const quotedPhrase = (s) => {
    const rx = /[„"]([^”“"„]{2,60})[”“"]/g;
    const found = [];
    let m;
    while ((m = rx.exec(String(s || '')))) found.push(m[1].trim());
    const eng = found.filter(isEnglishText);
    return eng.length ? eng[eng.length - 1] : null;
  };

  // Lekcje AI (trial/full): portretowe kadry Izabeli. Inne: scena lekcji.
  function nextScene() {
    const path = (isTrial || isFull)
      ? LESSON_PORTRAITS[Math.floor(Math.random() * LESSON_PORTRAITS.length)]
      : (lesson.scene || (SCENES.length ? SCENES[Math.floor(Math.random() * SCENES.length)] : null));
    if (!path) return;
    sceneImg.onerror = () => { sceneImg.onerror = null; sceneImg.src = 'assets/izabela/izabela-lesson.png'; };
    sceneImg.src = path;
  }
  nextScene();

  mount.append(
    topbar(el('button.btn.btn--ghost', { onclick: () => navigate(isFull ? '#/home' : '#/lessons') }, ['Wróć'])),
    el('div.lesson-chat-card.fade-in', {}, [
      stage,
      el('div.lc-main', {}, [
        el('div.row', { style: 'justify-content:space-between;align-items:center' }, [
          el('h2.display', { style: 'margin:0;font-size:1.2rem', text: lesson.title }),
          progressEl,
        ]),
        chatEl,
        stepArea,
        el('div.composer', { style: 'flex-direction:column;align-items:center;gap:10px' }, [
          micBtn,
          targetEl,
          micLabel,
          el('div.row', { style: 'gap:10px;flex-wrap:wrap;justify-content:center' }, [replayBtn, stopBtn]),
        ]),
      ]),
    ])
  );

  // ---- pamięć lekcji próbnej: rozmowa wraca dokładnie tam, gdzie przerwano ----
  const HISTORY_CAP = 40;
  const memKeys = isFull ? ['fullHistory', 'fullChat'] : ['trialHistory', 'trialChat'];
  function persistLesson() {
    if (!isTrial && !isFull) return;
    const trimmed = history.length > HISTORY_CAP ? [history[0], ...history.slice(-HISTORY_CAP)] : [...history];
    store.patchKey('progress', { [memKeys[0]]: trimmed, [memKeys[1]]: chatLog.slice(-12) });
  }
  function clearLessonMemory() {
    if (isTrial || isFull) store.patchKey('progress', { [memKeys[0]]: [], [memKeys[1]]: [] });
  }

  mount.append(feedbackCorner('lekcja'));

  // Start: AI prowadzi lekcję, albo proste kroki (fallback bez Gemini)
  if (aiLed) {
    startAiLesson();
  } else if (lesson.intro) {
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
    else setMicLabel('');
  }

  async function startAiLesson() {
    const topic = lesson.aiTopic || lesson.title;
    const name = (store.get().user?.name || '').trim();

    // Wznowienie: jest zapisana rozmowa → kontynuujemy, nie zaczynamy od zera
    const saved = (isTrial || isFull) ? store.get().progress : {};
    const savedHist = saved[memKeys[0]], savedChat = saved[memKeys[1]];
    if ((isTrial || isFull) && Array.isArray(savedHist) && savedHist.length > 1) {
      history.push(...savedHist);
      (savedChat || []).forEach((m) => addMessage(m.who, m.text, { save: false }));
      chatLog = [...(savedChat || [])];
      const back = [
        'No i jesteśmy z powrotem! Lecimy dalej.',
        'O, wracasz! Kontynuujemy, nie ma spania.',
        'Alright, jedziemy dalej z tematem!',
      ][Math.floor(Math.random() * 3)];
      introGate = new Promise((res) => { speakLine(back, { lang: 'pl', onEnd: res }); setTimeout(res, 7000); });
      history.push({ role: 'user', text: 'Wróciliśmy po przerwie do tej samej lekcji. NIE witaj się od nowa i NIE zaczynaj tematu od początku. Jednym zdaniem nawiąż do ostatniego ćwiczenia i kontynuuj dokładnie od miejsca, w którym skończyliśmy.' });
      await aiTurn();
      return;
    }

    // Świeży start: Izabela odzywa się OD RAZU (składane powitanie),
    // a w tle leci zapytanie do AI — zero głuchej ciszy po wejściu.
    const hello = lessonHello(name);
    introGate = new Promise((res) => { speakLine(hello, { lang: 'pl', onEnd: res }); setTimeout(res, 7000); });
    history.push({ role: 'user', text: `Rozpocznij lekcję mówienia na temat: "${topic}". WAŻNE: już się przywitałaś słowami "${hello}" — NIE witaj się ponownie. Od razu, bez wstępów, naucz pierwszej prostej frazy (po angielsku w cudzysłowie + znaczenie po polsku + poproś o powtórzenie).` });
    await aiTurn();
  }

  async function aiTurn() {
    setBusy(true);
    const r = await ai.lessonReply(history);
    await introGate;                                 // nie przerywaj powitania w pół słowa
    setBusy(false);
    if (r.unsupported) { startStep(); return; }     // brak Gemini → kroki
    history.push({ role: 'model', text: r.say });
    if (r.mistake) setMood('oops');
    speakLine(r.say, { lang: r.lang, onEnd: () => setMood('neutral') });
    setTarget(quotedPhrase(r.say) || (r.suggestions || [])[0] || null);
    persistLesson();
    if (r.done) {
      store.markLessonDone(lesson.id);
      clearLessonMemory();
      toast('Lekcja ukończona!');
    }
  }

  async function handleAiAnswer(text) {
    history.push({ role: 'user', text });
    persistLesson();
    await aiTurn();
  }

  // ---------- pomocnicze ----------
  // Wspólny czat: dymki Izabeli (od jej strony) + odpowiedzi ucznia, przewijalne.
  function addMessage(who, text, { save = true } = {}) {
    const node = el(`div.msg.msg--${who === 'izabela' ? 'izabela' : 'user'}`, {}, [
      el('div.who', { text: who === 'izabela' ? 'Izabela' : 'Ty' }),
      el('div', { text }),
    ]);
    chatEl.append(node);
    chatEl.scrollTop = chatEl.scrollHeight;
    if (save) { chatLog.push({ who: who === 'izabela' ? 'izabela' : 'user', text }); persistLesson(); }
  }
  function setSpeaking(on) { setAvSpeaking(on); }
  function setMicLabel(t) { micLabel.textContent = t; }

  // Mówi i zapamiętuje ostatnią kwestię. lang 'pl'|'en'; slow = wolniej.
  // Powtórka tej samej kwestii (Powtórz / klik w Izabelę) nie dubluje dymka.
  function speakLine(text, { lang = 'pl', slow = false, onEnd } = {}) {
    if (!lastLine || lastLine.text !== text) addMessage('izabela', text);
    lastLine = { text, lang, slow };
    setSpeaking(true);
    speech.speak(text, { lang: lang === 'en' ? 'en-US' : 'pl-PL', rate: slow ? 0.7 : 1,
      onEnd: () => { setSpeaking(false); onEnd?.(); } });
  }
  function izabelaSay(text, { lang = 'pl', slow = false, mood = 'neutral', onEnd } = {}) {
    setMood(mood);
    speakLine(text, { lang, slow, onEnd: () => { setMood('neutral'); onEnd?.(); } });
  }
  // (chipsy z podpowiedziami zastąpione jednym „Powtórz: ..." przy mikrofonie)
  function renderSuggestions(list) { setTarget((list || [])[0] || null); }

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
      // Cicha zmiana tematu — bez komentowania, że „pomijamy"
      history.push({ role: 'user', text: 'Przejdź do zupełnie nowej, innej frazy lub tematu. NIE komentuj pomijania, nie mów że coś pomijamy — po prostu ucz dalej, naturalnie.' });
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

  // ---------- mikrofon (mówienie + pytania, można przerwać Izabelę) ----------
  // Klikasz tylko START — nagranie samo kończy się po chwili ciszy.
  // Mów w dowolnym języku, możesz swobodnie mieszać polski i angielski.
  let finalized = false;
  async function toggleListen() {
    if (busy || processing) return;
    if (listening) return stopListening();   // (opcjonalnie: drugie kliknięcie kończy wcześniej)
    speech.stopSpeaking();                    // naciśnięcie mikrofonu PRZERYWA Izabelę
    setSpeaking(false);
    if (useGeminiStt) return startRecording();
    return startBrowserListen();
  }

  function stopListening() {
    if (recHandle) { recHandle.stop(); return; }   // ścieżka Gemini (auto-stop wywoła finalize)
    recorder?.stop();                               // ścieżka przeglądarki
  }

  // --- Ścieżka Gemini: nagranie audio (auto-stop po ciszy) → transkrypcja PL+EN ---
  async function startRecording() {
    finalized = false;
    try { recHandle = await speech.recordAudio({ autoStop: true, onStop: finalizeRecording }); }
    catch (e) { toast('Mikrofon: ' + (e.message || e), 'error'); resetMic(); return; }
    listening = true;
    micBtn.classList.add('recording'); micBtn.textContent = 'Słucham';
    setMicLabel('Mów śmiało — sama skończę, gdy ucichniesz (możesz mieszać PL i EN)');
  }

  async function finalizeRecording() {
    if (finalized) return; finalized = true;       // nagranie skończone (auto lub ręcznie)
    const h = recHandle; recHandle = null;
    listening = false; processing = true;
    micBtn.classList.remove('recording'); micBtn.textContent = 'Mów';
    micBtn.disabled = true; micBtn.style.opacity = '0.5';
    setMicLabel('Rozpoznaję, co powiedziałeś…');
    let audio = null;
    try { audio = await h.done; } catch (e) { /* ignore */ }
    let text = null;
    if (audio && audio.base64) { try { text = await ai.transcribe(audio); } catch (e) { /* ignore */ } }
    processing = false; resetMic();
    if (text) handleAnswer(text);
    else setMicLabel('Nie dosłyszałam — naciśnij i powiedz jeszcze raz');
  }

  // --- Ścieżka zapasowa (bez Gemini): rozpoznawanie przeglądarki, jeden język ---
  function startBrowserListen() {
    listening = true; micBtn.classList.add('recording'); micBtn.textContent = 'Słucham'; setMicLabel('Słucham… mów teraz');
    let heard = '';
    recorder = speech.listen({
      lang: FALLBACK_REC_LANG,
      onResult: (t) => { heard = t; setMicLabel(`„${t}"`); },
      onError: (e) => { toast('Mikrofon: ' + (e.message || e), 'error'); resetMic(); },
      onEnd: () => { resetMic(); if (heard) handleAnswer(heard); else setMicLabel('Nie dosłyszałam — naciśnij i powiedz jeszcze raz'); },
    });
  }

  function resetMic() {
    listening = false; recorder = null; recHandle = null;
    micBtn.disabled = false; micBtn.style.opacity = '1';
    micBtn.classList.remove('recording'); micBtn.textContent = 'Mów';
    setMicLabel('');
  }
}
