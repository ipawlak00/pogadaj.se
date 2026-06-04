import { el, topbar, toast, navigate } from '../ui.js';
import { store } from '../state.js';
import { speech } from '../services/speech.js';
import { ai, isBeginner } from '../services/ai.js';
import { getLesson } from '../data/lessons.js';
import { izabela, setMood, setSpeaking as setAvSpeaking } from '../components/izabela.js';

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

  const micBtn = el('button.mic-btn', { 'aria-label': 'Mów', onclick: toggleListen }, ['🎙']);
  const micLabel = el('div.faint', { id: 'mic-label', style: 'text-align:center', text: 'Naciśnij mikrofon i mów 🎙' });

  const backChip = el('button.btn.btn--ghost', { onclick: () => navigate('#/lessons') }, ['← Lekcje']);
  const avatar = izabela({ mood: 'neutral', size: 64 });

  mount.append(
    topbar(backChip),
    el('div.stack.fade-in', {}, [
      el('div.row', { style: 'gap:14px' }, [
        avatar,
        el('div', {}, [
          el('h2.display', { style: 'margin:0', text: `${lesson.emoji} ${lesson.title}` }),
          el('p.faint', { style: 'margin:2px 0 0', text: lesson.goal }),
        ]),
      ]),
      el('div.convo-layout', {}, [
        el('div', {}, [
          chatEl,
          lesson.type === 'task' ? taskBlock() : null,
          el('div.composer', { style: 'flex-direction:column;align-items:center;gap:10px' }, [ micBtn, micLabel ]),
          el('p.faint', { style: 'margin-top:8px;font-size:.8rem;text-align:center', text: ai.provider === 'stub'
            ? 'Tryb demo (AI lokalne). Po podpięciu Gemini Izabela rozmawia w pełni naturalnie.' : '' }),
        ]),
        analystEl,
      ]),
    ])
  );

  // Otwarcie lekcji — Izabela wita (po polsku dla początkujących)
  const beginner = isBeginner();
  const opener = beginner && lesson.openerPL ? lesson.openerPL : lesson.opener;
  addMessage('izabela', opener);
  speech.speak(opener, { lang: beginner ? 'pl-PL' : 'en-US' });

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

  function setSpeaking(on) { setAvSpeaking(avatar, on); }
  function setMicLabel(t) { const l = document.getElementById('mic-label'); if (l) l.textContent = t; }

  // ---------- Wejście ucznia: TYLKO MÓWIENIE ----------
  // Początkujący mówią po polsku → słuchamy pl-PL. Zaawansowani → en-US.
  function toggleListen() {
    if (listening) { recorder?.stop(); return; }
    listening = true; micBtn.classList.add('recording'); micBtn.textContent = '⏹'; setMicLabel('Słucham… mów teraz 🎤');
    let heard = '';
    recorder = speech.listen({
      lang: beginner ? 'pl-PL' : 'en-US',
      onResult: (t) => { heard = t; setMicLabel(`„${t}"`); },
      onError: (e) => { toast('Mikrofon: ' + (e.message || e), 'error'); resetMic(); },
      onEnd: async () => {
        resetMic();
        if (heard) await handleUtterance(heard);
        else setMicLabel('Nie dosłyszałam — naciśnij i powiedz jeszcze raz 🎙');
      },
    });
  }
  function resetMic() { listening = false; micBtn.classList.remove('recording'); micBtn.textContent = '🎙'; setMicLabel('Naciśnij mikrofon i mów 🎙'); }

  async function handleUtterance(text) {
    addMessage('user', text);
    userTurns++;

    // Głosowe Koło Ratunkowe w zadaniu: prośba o pomoc
    if (lesson.type === 'task' && /podpowiedz|pomóż|help|nie wiem|hint|agent/i.test(text)) {
      const { reply } = await ai.hint({ task: lesson.task, text });
      respond(reply, null, null, 'pl');
      return;
    }

    const { reply, correction, mistake, lang } = await ai.chat({ text, lesson });
    respond(reply, correction, mistake, lang);

    // Cel lekcji konwersacyjnej: kilka tur
    if (lesson.type === 'conversation' && userTurns >= 4) finishLessonSoon();
  }

  function respond(reply, correction, mistake, lang = 'en') {
    // ostatnia wiadomość ucznia dostaje znacznik poprawki
    if (correction && messages.length) {
      const last = chatEl.querySelector('.msg--user:last-of-type');
      if (last) last.append(el('div.correction', { html: `💡 <b>Poprawka:</b> ${correction.spoken}` }));
    }
    if (mistake) addMistake(mistake);
    // Izabela reaguje miną: "ups" gdy poprawia błąd, inaczej zadowolona
    setMood(avatar, mistake ? 'oops' : 'happy');
    addMessage('izabela', reply);
    setSpeaking(true);
    speech.speak(reply, { lang: lang === 'en' ? 'en-US' : 'pl-PL', onEnd: () => { setSpeaking(false); setMood(avatar, 'neutral'); } });
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
      el('div.display', { style: 'font-size:1.2rem;margin-bottom:6px', text: t.prompt }),
      (beginner && t.promptPL) ? el('div.faint', { style: 'margin-bottom:14px', text: t.promptPL }) : el('div', { style: 'margin-bottom:8px' }),
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
