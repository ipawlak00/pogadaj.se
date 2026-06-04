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

  const beginner = isBeginner();   // dostępne dla taskBlock() i całej rozmowy
  const messages = [];     // { who:'izabela'|'user', text, correction? }
  const sessionMistakes = [];
  let listening = false;
  let recorder = null;
  let userTurns = 0;
  let taskPhase = 'word';   // 'word' → powiedz słowo, 'sentence' → powtórz całe zdanie
  let taskAttempts = 0;

  const chatEl = el('div.chat');
  const analystEl = el('div.card.analyst', {}, [
    el('h3.display', { text: '🧪 Analityk' }),
    el('p.faint', { id: 'analyst-empty', text: 'Tu pojawią się Twoje błędy z tłumaczeniem — do późniejszej powtórki.' }),
    el('div', { id: 'analyst-list' }),
  ]);

  const micBtn = el('button.mic-btn', { 'aria-label': 'Mów', onclick: toggleListen }, ['🎙']);
  const micLabel = el('div.faint', { id: 'mic-label', style: 'text-align:center', text: 'Naciśnij mikrofon i mów 🎙' });
  const suggestRow = el('div.suggest-row', { id: 'suggest-row' });

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
          suggestRow,
          el('div.composer', { style: 'flex-direction:column;align-items:center;gap:10px' }, [ micBtn, micLabel ]),
          el('p.faint', { style: 'margin-top:8px;font-size:.8rem;text-align:center', text: ai.provider === 'stub'
            ? 'Tryb demo (AI lokalne). Po podpięciu Gemini Izabela rozmawia w pełni naturalnie.' : '' }),
        ]),
        analystEl,
      ]),
    ])
  );

  // Otwarcie lekcji — Izabela wita (po polsku dla początkujących i w zadaniach)
  const opener = beginner && lesson.openerPL ? lesson.openerPL : lesson.opener;
  const openerLang = (beginner || lesson.type === 'task') ? 'pl-PL' : 'en-US';
  addMessage('izabela', opener);
  speech.speak(opener, { lang: openerLang });

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

  // Podpowiedzi słów: chip pokazuje frazę, dotknięcie = Izabela czyta ją po angielsku
  function renderSuggestions(list) {
    suggestRow.replaceChildren();
    if (!list || !list.length) return;
    suggestRow.append(el('div.suggest-hint', { text: '💡 Możesz powiedzieć (dotknij, by usłyszeć):' }));
    suggestRow.append(el('div.suggest-chips', {}, list.slice(0, 4).map((s) =>
      el('button.suggest-chip', { onclick: () => speech.speak(s, { lang: 'en-US' }) }, [s]))));
  }
  renderSuggestions(lesson.suggestions || []);

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

    // Lekcja z zadaniem — odpowiedź MÓWIONA (osobny tok)
    if (lesson.type === 'task') return handleTaskAnswer(text);

    const { reply, correction, mistake, lang, suggestions } = await ai.chat({ text, lesson });
    respond(reply, correction, mistake, lang);
    if (suggestions && suggestions.length) renderSuggestions(suggestions);

    // Cel lekcji konwersacyjnej: kilka tur
    if (lesson.type === 'conversation' && userTurns >= 4) finishLessonSoon();
  }

  // Krótka wypowiedź Izabeli (z głosem). lang 'pl'|'en'; slow = wolniej.
  function izabelaSay(text, { lang = 'pl', slow = false, mood = 'neutral', onEnd } = {}) {
    setMood(avatar, mood);
    addMessage('izabela', text);
    setSpeaking(true);
    speech.speak(text, {
      lang: lang === 'en' ? 'en-US' : 'pl-PL', rate: slow ? 0.72 : 1,
      onEnd: () => { setSpeaking(false); setMood(avatar, 'neutral'); onEnd?.(); },
    });
  }

  const norm = (s) => (s || '').toLowerCase().replace(/[^a-ząćęłńóśźż ]/gi, ' ').replace(/\s+/g, ' ').trim();

  // Tok zadania: faza 'word' (powiedz słowo) → faza 'sentence' (powtórz całe zdanie)
  async function handleTaskAnswer(text) {
    const t = lesson.task;
    if (/podpowiedz|pomóż|help|nie wiem|hint|agent/i.test(text)) {
      izabelaSay(t.hintSpoken, { lang: 'pl' });
      return;
    }
    if (taskPhase === 'word') {
      if (norm(text).split(' ').includes(norm(t.answer))) {
        izabelaSay(`Ekstra! 🎉 Dokładnie — „${t.answer}". A teraz dawaj całe zdanie za mną, powtórz: „${t.fullSentence}"`, {
          lang: 'pl', mood: 'happy',
        });
        taskPhase = 'sentence';
        renderSuggestions([t.fullSentence]);
      } else {
        taskAttempts++;
        if (taskAttempts >= 2) {
          izabelaSay(`Spokojnie, zwolnijmy. Posłuchaj dokładnie: „${t.answer}". ${t.hintSpoken} Teraz Ty — powiedz to słowo.`, { lang: 'pl', slow: true, mood: 'oops' });
        } else {
          izabelaSay(`Jeszcze nie to 🙂 ${t.hintSpoken} Spróbuj powiedzieć samo brakujące słowo.`, { lang: 'pl', mood: 'oops' });
        }
      }
    } else {
      // faza zdania — sprawdzamy pokrycie słów
      const heard = norm(text).split(' ');
      const target = norm(t.fullSentence).split(' ');
      const overlap = target.filter((w) => heard.includes(w)).length / target.length;
      if (overlap >= 0.6) {
        izabelaSay('Brawo! Całe zdanie, super Ci poszło! 🌟 Czujesz, jak to brzmi naturalnie?', { lang: 'pl', mood: 'happy', onEnd: completeLesson });
      } else {
        taskAttempts++;
        izabelaSay(`Już prawie! Powtórzmy razem, wolniutko za mną: „${t.fullSentence}"`, { lang: 'pl', slow: true });
      }
    }
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

  // ---------- Blok zadania (mówione, lekcja typu 'task') ----------
  function taskBlock() {
    const t = lesson.task;
    return el('div.card', { style: 'margin:14px 0' }, [
      el('div.muted', { style: 'margin-bottom:8px', text: 'Powiedz brakujące słowo:' }),
      // Zdanie po angielsku (z luką)
      el('div.task-en', { text: t.sentence }),
      // Polskie tłumaczenie — podkreślone słowo, klik = czyta wersję angielską
      el('div.task-pl', {}, plSentence(t.sentencePL, t.answer)),
      // 3 opcje — klik = głos czyta po angielsku i podaje znaczenie po polsku
      el('div.task-opts', {}, t.options.map((o) =>
        el('button.suggest-chip', {
          onclick: () => speech.speak(`„${o.en}" — ${o.pl}`, { lang: 'pl-PL' }),
        }, [o.en]))),
      el('p.faint', { style: 'margin-top:12px', text: '🎤 Powiedz odpowiedź do mikrofonu. Utknąłeś? Powiedz „Agent, podpowiedz!"' }),
    ]);
  }

  // Buduje polskie zdanie z podkreślonym słowem (klik → czyta angielski odpowiednik)
  function plSentence(s, answer) {
    const m = s.match(/^(.*?)\*(.+?)\*(.*)$/);
    if (!m) return [s];
    return [
      m[1],
      el('button.task-underline', {
        title: 'Posłuchaj po angielsku',
        onclick: () => speech.speak(answer, { lang: 'en-US' }),
      }, [m[2]]),
      m[3],
    ];
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
