import { el, topbar, toast, navigate } from '../ui.js';
import { store } from '../state.js';
import { speech } from '../services/speech.js';
import { ai } from '../services/ai.js';
import { getLesson } from '../data/lessons.js';

export function renderConversation(mount, lessonId) {
  const lesson = getLesson(lessonId);
  if (!lesson) { navigate('#/lessons'); return; }

  if (lesson.type === 'summary') return renderSummary(mount, lesson);

  const messages = [];     // { who:'izabela'|'user', text, correction? }
  const sessionMistakes = [];
  let listening = false;
  let recorder = null;
  let userTurns = 0;
  let taskSolved = false;

  const chatEl = el('div.chat');
  const analystEl = el('div.card.analyst', {}, [
    el('h3.display', { text: '🧪 Analityk' }),
    el('p.faint', { id: 'analyst-empty', text: 'Tu pojawią się Twoje błędy z tłumaczeniem — do późniejszej powtórki.' }),
    el('div', { id: 'analyst-list' }),
  ]);

  const input = el('input', { type: 'text', placeholder: 'Napisz po angielsku albo użyj mikrofonu →', onkeydown: (e) => { if (e.key === 'Enter') sendText(); } });
  const micBtn = el('button.btn.btn--pink.mic-mini', { 'aria-label': 'Mów', onclick: toggleListen }, ['🎙']);

  const backChip = el('button.btn.btn--ghost', { onclick: () => navigate('#/lessons') }, ['← Lekcje']);

  mount.append(
    topbar(backChip),
    el('div.stack.fade-in', {}, [
      el('div.row', { style: 'gap:14px' }, [
        el('div.izabela', { id: 'iza-avatar', style: 'width:64px;height:64px;flex:none' }, [
          el('img', { src: 'assets/izabela/avatar.svg', alt: 'Izabela', onerror: function(){ this.replaceWith(el('span',{text:'👩‍🚀'})); } }),
        ]),
        el('div', {}, [
          el('h2.display', { style: 'margin:0', text: `${lesson.emoji} ${lesson.title}` }),
          el('p.faint', { style: 'margin:2px 0 0', text: lesson.goal }),
        ]),
      ]),
      el('div.convo-layout', {}, [
        el('div', {}, [
          chatEl,
          lesson.type === 'task' ? taskBlock() : null,
          el('div.composer', {}, [ input, micBtn ]),
          el('p.faint', { style: 'margin-top:8px;font-size:.8rem', text: ai.provider === 'stub'
            ? 'Tryb demo (AI lokalne). Po podpięciu Gemini Izabela rozmawia w pełni naturalnie.' : '' }),
        ]),
        analystEl,
      ]),
    ])
  );

  // Otwarcie lekcji — Izabela wita
  addMessage('izabela', lesson.opener);
  speech.speak(stripPL(lesson.opener), { lang: 'en-US' });

  // ---------- Rendering wiadomości ----------
  function addMessage(who, text, correction) {
    messages.push({ who, text, correction });
    const node = el(`div.msg.msg--${who}`, {}, [
      el('div.who', { text: who === 'izabela' ? 'Izabela' : 'Ty' }),
      el('div', { text }),
      correction ? el('div.correction', { html: `💡 <b>Poprawka:</b> ${correction.spoken}` }) : null,
    ]);
    chatEl.append(node);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function addMistake(m) {
    sessionMistakes.push(m);
    store.addMistake(m);
    document.getElementById('analyst-empty')?.classList.add('hidden');
    document.getElementById('analyst-list').prepend(
      el('div.mistake.fade-in', {}, [
        el('div.tag', { text: m.tag || 'błąd' }),
        el('div', {}, [ el('span.bad', { text: m.bad }), ' → ', el('span.good', { text: m.good }) ]),
        el('div.note', { text: m.note }),
      ])
    );
  }

  function setSpeaking(on) {
    document.getElementById('iza-avatar')?.classList.toggle('izabela--speaking', on);
  }

  // ---------- Wejście ucznia ----------
  async function sendText() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await handleUtterance(text);
  }

  function toggleListen() {
    if (listening) { recorder?.stop(); return; }
    listening = true; micBtn.classList.add('recording'); micBtn.textContent = '⏹';
    let heard = '';
    recorder = speech.listen({
      onResult: (t) => { heard = t; input.value = t; },
      onError: (e) => { toast('Mikrofon: ' + (e.message || e), 'error'); resetMic(); },
      onEnd: async () => { resetMic(); if (heard) { input.value = ''; await handleUtterance(heard); } },
    });
  }
  function resetMic() { listening = false; micBtn.classList.remove('recording'); micBtn.textContent = '🎙'; }

  async function handleUtterance(text) {
    addMessage('user', text);
    userTurns++;

    // Głosowe Koło Ratunkowe w zadaniu: prośba o pomoc
    if (lesson.type === 'task' && /podpowiedz|pomóż|help|nie wiem|hint|agent/i.test(text)) {
      const { reply } = await ai.hint({ task: lesson.task, text });
      respond(reply, null, null);
      return;
    }

    const { reply, correction, mistake } = await ai.chat({ text, lesson });
    respond(reply, correction, mistake);

    // Cel lekcji konwersacyjnej: kilka tur
    if (lesson.type === 'conversation' && userTurns >= 4) finishLessonSoon();
  }

  function respond(reply, correction, mistake) {
    // ostatnia wiadomość ucznia dostaje znacznik poprawki
    if (correction && messages.length) {
      const last = chatEl.querySelector('.msg--user:last-of-type');
      if (last) last.append(el('div.correction', { html: `💡 <b>Poprawka:</b> ${correction.spoken}` }));
    }
    if (mistake) addMistake(mistake);
    addMessage('izabela', reply);
    setSpeaking(true);
    speech.speak(stripPL(reply), { lang: 'en-US', onEnd: () => setSpeaking(false) });
  }

  let finishing = false;
  function finishLessonSoon() {
    if (finishing) return; finishing = true;
    setTimeout(() => {
      addMessage('izabela', 'That was great chatting with you! 🎉 Świetnie Ci poszło. Kliknij „Zakończ lekcję", żeby zapisać postęp.');
      const done = el('button.btn.btn--primary.btn--block', { onclick: completeLesson }, ['Zakończ lekcję ✓']);
      chatEl.parentElement.querySelector('.composer').replaceWith(done);
    }, 800);
  }

  function completeLesson() {
    store.markLessonDone(lesson.id);
    toast('Lekcja ukończona! 🌟');
    navigate('#/lessons');
  }

  // ---------- Blok zadania (lekcja typu 'task') ----------
  function taskBlock() {
    const t = lesson.task;
    const wrap = el('div.card', { style: 'margin:14px 0' }, [
      el('div.muted', { style: 'margin-bottom:8px', text: 'Uzupełnij zdanie:' }),
      el('div.display', { style: 'font-size:1.2rem;margin-bottom:14px', text: t.prompt }),
      el('div.row.wrap', {}, t.options.map((opt) =>
        el('button.btn.btn--ghost', { onclick: () => checkAnswer(opt, wrap) }, [opt]))),
      el('p.faint', { style: 'margin-top:10px', text: '💬 Utknąłeś? Powiedz do mikrofonu: „Agent, podpowiedz!"' }),
    ]);
    return wrap;

    function checkAnswer(opt, wrap) {
      if (opt === t.answer) {
        taskSolved = true;
        addMessage('izabela', `"${opt}" — exactly! 🎯 ${t.explanation}`);
        speech.speak(`${opt}. Exactly!`, { lang: 'en-US' });
        wrap.replaceWith(el('div.card', { style: 'margin:14px 0;border-color:var(--cyan)' }, [
          el('div', { html: `✅ <b>${t.prompt.replace('____', opt)}</b>` }),
          el('div.note', { text: t.explanation }),
          el('button.btn.btn--primary.btn--block', { style: 'margin-top:12px', onclick: completeLesson }, ['Zakończ lekcję ✓']),
        ]));
      } else {
        toast('Prawie! Spróbuj jeszcze raz — albo poproś Izabelę o podpowiedź 😊', 'error');
        addMistake({ bad: lesson.task.prompt.replace('____', opt), good: lesson.task.prompt.replace('____', t.answer), note: t.explanation, tag: 'grammar' });
      }
    }
  }
}

// ---------- Lekcja 3: Podsumowanie / Cliffhanger ----------
function renderSummary(mount, lesson) {
  const st = store.get();
  const mistakes = st.analyst;
  const tags = mistakes.reduce((a, m) => { a[m.tag] = (a[m.tag] || 0) + 1; return a; }, {});
  const phon = st.phonetic.profile;

  mount.append(
    topbar(el('button.btn.btn--ghost', { onclick: () => navigate('#/lessons') }, ['← Lekcje'])),
    el('div.stack.fade-in', { style: 'max-width:640px;margin:0 auto' }, [
      el('div.center', {}, [
        el('div', { style: 'font-size:3rem', text: '🚀' }),
        el('h1.display', { style: 'margin:6px 0', text: 'Twój raport z kosmosu' }),
        el('p.muted', { text: lesson.opener }),
      ]),
      el('div.card.stack', {}, [
        el('h3.display', { style: 'margin:0', text: '📊 Co zauważyłam' }),
        statRow('Zebrane błędy do powtórki', mistakes.length),
        statRow('Gramatyka', tags.grammar || 0),
        statRow('Słownictwo', tags.vocab || 0),
        statRow('Wymowa (z paszportu)', phon?.challenges?.length || 0),
        phon?.challenges?.length
          ? el('div.pill', { text: `🎯 Dźwięki do szlifu: ${phon.challenges.join(', ')}` })
          : null,
      ]),
      el('div.card.center.stack', { style: 'border-color:var(--pink)' }, [
        el('h2.display', { style: 'margin:0', text: 'To dopiero rozgrzewka... 👀' }),
        el('p.muted', { text: 'W pełnej wersji rozmawiamy bez limitu, a Izabela prowadzi Cię aż do płynności. Odblokuj pełny kurs na stronie.' }),
        el('a.btn.btn--pink.btn--lg', { href: 'https://pogadaj.se', target: '_blank' }, ['Odblokuj pełny dostęp →']),
        el('button.btn.btn--ghost', { onclick: () => { store.markLessonDone(lesson.id); navigate('#/lessons'); } }, ['Wróć do lekcji']),
      ]),
    ])
  );
  store.markLessonDone(lesson.id);

  function statRow(label, val) {
    return el('div.row', { style: 'justify-content:space-between' }, [
      el('span.muted', { text: label }),
      el('span.display', { style: 'font-size:1.3rem', text: val }),
    ]);
  }
}

// Usuwa polskie wstawki z TTS angielskiego (proste przybliżenie dla trybu demo)
function stripPL(text) {
  return text.replace(/[„""]/g, '"');
}
