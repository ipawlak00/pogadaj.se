import { el, navigate, feedbackCorner } from '../ui.js';
import { store } from '../state.js';
import { speech } from '../services/speech.js';
import { minutesWord, isFemale } from '../data/phrases.js';
import { pickFresh } from '../data/rotate.js';

// HISTORIA LEKCJI, Izabela rysuje przy konsoli (scene-17).
// Okienka lekcji (zwinięte do tytułu) rozrzucone w strefach, które NIE
// zasłaniają twarzy Izabeli ani kotów. Klik rozwija podsumowanie.
export function renderHistory(mount) {
  // Klasę 'on-lessons' ustawia router (app.js) wg trasy, tu nie ruszamy.
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
    `Ej, no bez jaj, tu praktycznie nic nie ma! Ale brechta. Trzeba nagadać, ${addr}.`,
    'Pustka jak w kosmosie, tylko bez gwiazdek. Nagadaj mi trochę, to się zaroi!',
    `Ale tu głucho! Moje kotki mają bogatszy pamiętnik niż Ty, ${addr}. No brechta!`,
    'Historia? Jaka historia, przecież tu wieje! Wpadaj na lekcję, zmieniamy to.',
    'Serio, ledwo zaczęliśmy, tu jeszcze echo się niesie. Dawaj, nagadamy trochę!',
    'Chudziutko tu, mówię Ci. Godzinki jeszcze nie zebraliśmy, więc chwalić się nie ma czym. Na razie!',
  ];
  // Godzina,8h: jest podstawa, ale bez szału, Izabela zagrzewa do dalszej jazdy.
  const midLines = [
    'No i mamy godzinę z hakiem! Spoko, jest git, ale szału jeszcze nie ma. Ciśnij dalej!',
    'Godzinka wbita, nieźle! Tylko wiesz co, przegadać osiem godzin to dopiero jest coś. Lecimy!',
    'O, robi się! Jest podstawa, ale nie osiadaj na laurach, dobijemy do naprawdę grubych liczb.',
    `Coś tam nagadaliśmy, szacun. Ale ja bym Cię widziała na ośmiu godzinach, wpadaj częściej, ${addr}!`,
    'Jest zaczyn! Nie odpuszczaj, im więcej gadania, tym szybciej Ci wejdzie. Ciśniemy dalej!',
  ];
  // 8h+: realna pochwała, to już kawał roboty.
  const manyLines = [
    'O, patrz, ile już przegadaliśmy, kawał roboty! Naprawdę nieźle nam idzie.',
    'Osiem godzin gadania z hakiem? To już wyższa liga, mega jestem z Ciebie dumna!',
    'Zobacz, ile tego jest. Robi wrażenie, tak trzymaj, mistrzu!',
    'Kopę tego uzbieraliśmy. Widać robotę i widać postęp, brawo Ty!',
  ];
  // Progi: <1h prawie pusto (brechta), 1,8h „git, ale ciśnij", 8h+ pochwała.
  const totalMin = Math.round(entries.reduce((a, e) => a + (e.seconds || 0), 0) / 60);
  const pool = totalMin < 60 ? fewJokes : totalMin < 480 ? midLines : manyLines;
  const spoken = pickFresh('history', pool);

  // Kolumna okienek po PRAWEJ stronie, w dolnej części (biurko/konsola) ,
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

  // Dymek z tym, co mówi Izabela (lewy górny róg, bezpieczna strefa)
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
