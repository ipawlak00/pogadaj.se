import { el, navigate, feedbackCorner } from '../ui.js';
import { store } from '../state.js';
import { speech } from '../services/speech.js';
import { minutesWord, isFemale } from '../data/phrases.js';

// HISTORIA LEKCJI — Izabela rysuje przy konsoli (scene-17).
// Okienka lekcji (zwinięte do tytułu) rozrzucone w strefach, które NIE
// zasłaniają twarzy Izabeli ani kotów. Klik rozwija podsumowanie.
export function renderHistory(mount) {
  // Klasę 'on-lessons' ustawia router (app.js) wg trasy — tu nie ruszamy.
  const screen = el('div.history-fs');
  mount.append(screen);

  const entries = [...(store.get().progress.history || [])].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

  function fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  }
  function fmtDur(sec) {
    const m = Math.max(1, Math.round((sec || 0) / 60));
    return `${m} ${minutesWord(m)}`;
  }

  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const name = (store.get().user?.name || '').trim();
  const addr = isFemale(name) ? 'koleżanko' : 'kolego';

  const fewJokes = [
    `Ej, no bez jaj — tu praktycznie nic nie ma! Ale brechta. Trzeba nagadać, ${addr}.`,
    'Pustka jak w kosmosie, tylko bez gwiazdek. Nagadaj mi trochę, to się zaroi!',
    `Ale tu głucho! Moje kotki mają bogatszy pamiętnik niż Ty, ${addr}. No brechta!`,
    'Historia? Jaka historia, przecież tu wieje! Wpadaj na lekcję, zmieniamy to.',
    'Serio, ledwo zaczęliśmy — tu jeszcze echo się niesie. Dawaj, nagadamy trochę!',
    'Chudziutko tu, mówię Ci. Godzinki jeszcze nie zebraliśmy, więc chwalić się nie ma czym. Na razie!',
  ];
  const manyLines = [
    'O, patrz, cała nasza historia jak na dłoni. Nieźle nam idzie, co?',
    'Wszystko tu mam, o czym gadaliśmy. Fajnie się to ogląda.',
    'Zobacz, ile już razem przegadaliśmy. Robi wrażenie!',
  ];
  // Dopóki nie ma chociaż GODZINY nagadane, w historii realnie prawie nic nie ma
  // — wtedy Izabela się brechta, że pusto. „Nieźle nam idzie" dopiero od godziny.
  const totalMin = Math.round(entries.reduce((a, e) => a + (e.seconds || 0), 0) / 60);
  const sparse = totalMin < 60;
  const spoken = sparse ? pick(fewJokes) : pick(manyLines);

  // Kolumna okienek po PRAWEJ stronie, w dolnej części (biurko/konsola) —
  // nie zasłania twarzy Izabeli ani kotów. Zwinięte = tytuł, klik rozwija.
  const cards = el('div.history-cards', {},
    entries.map((e) => {
      const card = el('div.history-item', {
        title: 'Kliknij, aby rozwinąć',
        onclick: () => card.classList.toggle('open'),
      }, [
        el('div.history-item__head', {}, [
          el('span.history-item__kind', { text: e.kind === 'trial' ? 'Lekcja próbna' : 'Lekcja' }),
          el('span.history-item__meta', { text: `${fmtDate(e.startedAt)} · ${fmtDur(e.seconds)}` }),
        ]),
        el('p.history-item__sum', { text: e.summary || 'Podsumowanie pojawi się po rozmowie.' }),
      ]);
      return card;
    }),
  );

  // Dymek z tym, co mówi Izabela (lewy górny róg — bezpieczna strefa)
  const bubble = el('div.scene-bubble', {
    style: 'left:2%; top:14%', title: 'Kliknij, a powtórzę',
    onclick: () => speech.speak(spoken, { lang: 'pl-PL' }),
  }, [
    el('div.scene-bubble__who', { text: 'Izabela' }),
    el('p', { style: 'margin:0', text: spoken }),
  ]);

  screen.replaceChildren(
    el('header.lessons-fs__top', {}, [
      el('div.logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
      el('div.lessons-fs__tools', {}, [
        el('button.btn.btn--sq', { onclick: () => navigate('#/home') }, ['Wróć']),
      ]),
    ]),
    el('img.scene-photo', { src: 'assets/scenes/scene-17.jpg', alt: 'Izabela', style: 'object-position:50% 24%' }),
    bubble,
    cards,
    feedbackCorner('historia lekcji'),
  );

  speech.speak(spoken, { lang: 'pl-PL' });
}
