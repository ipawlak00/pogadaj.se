import { el, navigate, feedbackCorner, accountButton } from '../ui.js';
import { store } from '../state.js';
import { auth } from '../services/auth.js';
import { speech, splitSentences } from '../services/speech.js';
import { FULL_MONTH_MINUTES, HOME_SCENES } from '../data/lessons.js';
import { minutesWord, hoursWord } from '../data/phrases.js';
import { pickFresh } from '../data/rotate.js';
import { JOKES } from '../data/jokes.js';

// Ciekawostki wplecione naturalnie (jak Izabela dzieli się myślą), mózg,
// psychologia, kosmos, astrologia, magiczne kamienie. Co jakiś czas, nie zawsze.
const FUN_FACTS = [
  'A tak w ogóle, wiesz co mi chodzi po głowie? Twój mózg zżera jakieś dwadzieścia procent energii całego ciała. Taki mały, a tak głodny.',
  'Ej, zerkam na mój opal i myślę sobie, że ten kamień ma w środku uwięzioną całą tęczę. Zawsze mnie to rozczula.',
  'Wiesz co jest szalone? W kosmosie w ogóle nie ma dźwięku. Totalna cisza dookoła nas.',
  'Taki myk na dziś: uśmiech, nawet na siłę, naprawdę potrafi poprawić nastrój. Mózg daje się na to nabrać, serio.',
  'Ostatnio czytałam, że dzień na Wenus trwa dłużej niż cały jej rok. Kosmos lubi mieszać w głowie.',
  'Mój opal podobno dodaje odwagi, a ja i tak lubię go najbardziej za te kolory. Numer jeden w mojej kolekcji.',
];

// Opowieści „z pokładu" na powitanie wracającego ucznia, jakby Izabela
// zdawała relację z podróży: kosmos, statek, fizyka kwantowa, poruszanie się
// w kosmosie, a czasem psoty kotów (Peja, kotka, Kocin, kot).
const JOURNEY_TIDBITS = [
  'Kiedy Cię nie było, przemknęliśmy tuż obok Mgławicy Kraba, to resztki gwiazdy, która wybuchła prawie tysiąc lat temu. Ludzie na Ziemi widzieli wtedy na niebie nowe światło, jaśniejsze od Wenus.',
  'Nasz statek łapał właśnie grawitacyjną procę wokół małego księżyca, taki kosmiczny trik, żeby przyspieszyć bez spalania paliwa. Sprytne, co nie?',
  'Czytałam ostatnio o fizyce kwantowej i głowa mi paruje: jedna maleńka cząstka potrafi być w dwóch miejscach naraz, dopóki na nią nie spojrzysz. Kosmos to jedna wielka ściema, mówię Ci!',
  'Wiesz, że w kosmosie jak raz się rozpędzisz, to lecisz w nieskończoność? Nie ma powietrza, które by Cię hamowało. My sobie płyniemy tak leniwie między gwiazdami.',
  'Kocin zasnął dziś rano w hełmie od skafandra i nie chciał wyłazić, wywabiłam go dopiero kocim chrupkiem. A Peja patrzyła na niego z boku, jakby był kompletnym głupkiem.',
  'Peja odkryła, że w stanie nieważkości można pływać w powietrzu, od godziny odbija się od ścian jak futrzana piłeczka. Kocin się obraził, że nie umie tak samo.',
  'Zerknęłam na pokładowy komputer: od naszej ostatniej rozmowy przelecieliśmy kawałek, który światło pokonuje w kilka minut. A wydawało się, że to była chwila!',
  'Mijamy teraz taką ciszę, że słychać własne myśli. W kosmosie dźwięk nie ma się jak nieść, żadnego powietrza. Trochę jak w bibliotece, tylko z gwiazdami za oknem.',
  'Kocin całą noc polował na czerwoną kropkę od wskaźnika laserowego, a rano obraził się na mnie, że mu jej nie oddałam. Koty i ich kosmiczne dramaty!',
  'Tłumaczę Ci: gdybyś w kosmosie strzelił palcami, nikt by tego nie usłyszał. Za to światło leci tak szybko, że w sekundę okrążyłoby Ziemię siedem razy. Ogarniasz?',
];

// Poziomy do zmiany z pełnej wersji (te same co w onboardingu)
const HOME_LEVELS = [
  { id: 'A1', title: 'A1, Początkujący', desc: 'Dopiero zaczynam, pojedyncze słowa.' },
  { id: 'A2', title: 'A2, Podstawowy',   desc: 'Proste zdania, codzienne sytuacje.' },
  { id: 'B1', title: 'B1, Średni',       desc: 'Daję radę w rozmowie, robię błędy.' },
  { id: 'B2', title: 'B2, Wyżej średni', desc: 'Mówię swobodnie, chcę szlifu.' },
  { id: 'C1', title: 'C1, Zaawansowany', desc: 'Płynnie, poleruję detale.' },
];

// PEŁNA WERSJA, tło (Izabela z kotami) zmienia się przy KAŻDYM wejściu.
// Przyciski i dymek są ustawiane per-scena tak, by nie zasłaniać twarzy ani kotów.
export function renderHome(mount) {
  // Klasę 'on-lessons' ustawia router (app.js) wg trasy, tu nie ruszamy.
  const screen = el('div.home-fs');
  mount.append(screen);

  // miesięczny reset budżetu
  const mk = new Date().toISOString().slice(0, 7);
  if (store.get().progress.fullMonth !== mk) {
    store.patchKey('progress', { fullMonth: mk, fullSecondsUsed: 0 });
  }

  const usedSec = store.get().progress.fullSecondsUsed || 0;
  const totalSec = FULL_MONTH_MINUTES * 60;
  const leftSec = Math.max(0, totalSec - usedSec);
  // floor, nie round, inaczej 14:59:30 wyświetlało się jako „14 h 60 min"
  const leftH = Math.floor(leftSec / 3600);
  const leftM = Math.floor((leftSec % 3600) / 60);
  const usedPct = Math.min(100, Math.round((usedSec / totalSec) * 100));

  const name = (store.get().user?.name || '').trim();
  const hasFullSession = (store.get().progress.fullHistory || []).length > 1;

  // Wybór sceny: rotujemy przy każdym wejściu (indeks trzymany w store),
  // więc obraz zmienia się za każdym razem, gdy wchodzisz na ekran.
  const rot = (store.get().progress.homeSceneIdx || 0) % HOME_SCENES.length;
  store.patchKey('progress', { homeSceneIdx: (rot + 1) % HOME_SCENES.length });
  const layout = HOME_SCENES[rot];
  screen.style.backgroundImage = `url('${layout.src}')`;
  if (layout.focus) screen.style.backgroundPosition = layout.focus;

  // Tablica z czasem (kompaktowa, w lewym górnym rogu, bezpieczna strefa)
  const board = el('div.home-board', {}, [
    el('div.time-board', {}, [
      el('div.time-board__time', { text: `Zostało ${leftH} h ${leftM} min` }),
      el('div.time-board__bar', {}, [ el('i', { style: `width:${usedPct}%` }) ]),
    ]),
  ]);

  // Kolejność (o którą prosiłaś): Historia → Zacznij nową lekcję (środek) → Kontynuuj
  const controls = el('div.home-controls', { style: layout.controls }, [
    el('button.btn.btn--sq', { onclick: () => navigate('#/history') }, ['Sprawdź historię swoich lekcji']),
    el('button.btn.btn--primary', {
      onclick: () => {
        store.patchKey('progress', { fullHistory: [], fullChat: [], currentFullId: null });
        speech.unlockAudio();
        navigate('#/lesson/full');
      },
    }, ['Zacznij nową lekcję']),
    hasFullSession ? el('button.btn.btn--sq', {
      onclick: () => { speech.unlockAudio(); navigate('#/lesson/full'); },
    }, ['Kontynuuj lekcję']) : null,
  ]);

  // Dymek z tym, co mówi Izabela (klik = powtórka), w bezpiecznej strefie sceny
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const firstTime = !store.get().progress.homeWelcomed;

  // Czas: w dymku skrót (15 h 0 min), a MÓWIONY pełnymi słowami (lektor czyta
  // „h" jako „hyy"), z poprawną odmianą godzin/minut.
  const timeShort = `${leftH} h ${leftM} min`;
  // Mówione pełnymi słowami, ale bez zbędnego „0 minut"/„0 godzin".
  const timeSpoken = leftH && leftM ? `${leftH} ${hoursWord(leftH)} i ${leftM} ${minutesWord(leftM)}`
    : leftH ? `${leftH} ${hoursWord(leftH)}`
    : `${leftM} ${minutesWord(leftM)}`;

  let hi, bodyText, bodySpoken;
  if (firstTime) {
    // Pierwsze wejście do pełnej wersji: ciepłe przywitanie + kim jest Izabela
    store.patchKey('progress', { homeWelcomed: true });
    hi = `Cześć${name ? ', ' + name : ''}! Ale się cieszę, że zostajesz ze mną na dłużej.`;
    bodyText = 'Poznamy się teraz lepiej. Wiesz, ja tak sobie lecę przez kosmos, w ciągłej podróży, ' +
      'szukając przygód. Ze mną lecą moje koty, Kocin i Peja, a od teraz też Ty. ' +
      `Na naszą wspólną podróż mam dla Ciebie ${timeSpoken} w miesiącu na rozmowy, ` +
      'żebyśmy razem szlifowali Twój angielski. No to zaczynamy!';
    bodySpoken = bodyText;
  } else {
    // Wracający uczeń: ciepłe „siemanko" + od razu opowieść z podróży
    // (kosmos/statek/fizyka/koty), a na końcu ile czasu zostało.
    hi = pickFresh('homeHi', [
      `Siemanko${name ? ', ' + name : ''}, witam ponownie!`,
      `O, jesteś${name ? ', ' + name : ''}! Dobrze Cię znowu widzieć.`,
      `Witaj z powrotem${name ? ', ' + name : ''}!`,
      'No i znów razem, lećmy dalej!',
    ]);
    const tidbit = pickFresh('homeTidbit', [...JOURNEY_TIDBITS, ...FUN_FACTS]);
    bodyText = `${tidbit} A tak przy okazji: masz jeszcze ${timeShort} rozmów w tym miesiącu. Klikaj i gadamy!`;
    bodySpoken = `${tidbit} A tak przy okazji: masz jeszcze ${timeSpoken} rozmów w tym miesiącu. Klikaj i gadamy!`;
  }
  // Zamiast jednego wielkiego dymka, krótkie zdania, które przeskakują
  // w miarę mówienia (dymek nie zakrywa sceny).
  // Dymek zmienia tekst AUTOMATYCZNIE w rytm mowy, pokazuje aktualne zdanie
  // (bez ręcznego scrollowania).
  const sentences = splitSentences(bodySpoken);
  const bodyP = el('p', { style: 'margin:4px 0 0', text: sentences[0] || bodyText });
  const bubble = el('div.scene-bubble', {
    style: layout.bubble, title: 'Kliknij, a powtórzę',
    onclick: () => playWelcome(),
  }, [
    el('div.scene-bubble__who', { text: 'Izabela' }),
    el('div.scene-bubble__hi', { text: hi }),
    bodyP,
  ]);
  function playWelcome() {
    speech.speakSequence([hi, ...sentences], {
      lang: 'pl-PL',
      onPart: (t, i) => { if (i > 0) bodyP.textContent = sentences[i - 1]; },
    });
  }

  // Klik „Opowiedz żart", Izabela wali sucharem w dymku (i na głos)
  let jokeBusy = false;
  function tellJoke() {
    if (jokeBusy) return; jokeBusy = true;
    speech.stopSpeaking();            // ucisz powitanie, żeby nie nadpisało żartu
    speech.unlockAudio();
    const hiEl = bubble.querySelector('.scene-bubble__hi');
    if (hiEl) hiEl.textContent = '';  // bez nagłówka, sama treść żartu
    // Żart z pewnej puli (bez powtórek). W dymku pokazujemy zdanie po zdaniu
    // w rytm mowy (setup → puenta), krótkie kawałki nigdy nie wychodzą poza dymek.
    const joke = pickFresh('jokes', JOKES);
    const parts = splitSentences(joke);
    bodyP.textContent = parts[0] || joke;
    speech.speakSequence(parts.length ? parts : [joke], {
      lang: 'pl-PL',
      onPart: (t, i) => { bodyP.textContent = parts[i] || t; },
      onDone: () => { jokeBusy = false; },
    });
    setTimeout(() => { jokeBusy = false; }, 15000);   // zapas, gdyby mowa nie ruszyła
  }

  const level = store.get().onboarding.level;
  screen.replaceChildren(
    el('header.lessons-fs__top', {}, [
      el('div.logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
      el('div.lessons-fs__tools', {}, [
        accountButton(),
        el('button.btn.btn--ghost', { onclick: tellJoke, title: 'Izabela wali sucharem' }, ['Opowiedz żart']),
        level ? el('button.btn.btn--ghost', { onclick: openLevelPicker, title: 'Zmień poziom' }, [`Poziom: ${level} · zmień`]) : null,
        el('button.btn.btn--ghost', { onclick: () => { auth.signOut(); location.hash = '#/'; location.reload(); } }, ['Wyloguj']),
      ]),
    ]),
    // widoczne tylko na telefonie (układ kartowy): zdjęcie sceny nad treścią
    el('img.scene-photo', { src: layout.src, alt: 'Izabela', style: `object-position:${layout.focus || 'center 30%'}` }),
    board,
    bubble,
    controls,
    feedbackCorner('pełna wersja'),
  );

  playWelcome();

  // Zmiana poziomu z pełnej wersji (te same poziomy co w onboardingu)
  function openLevelPicker() {
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onEsc); };
    const onEsc = (e) => { if (e.key === 'Escape') close(); };
    const overlay = el('div.level-overlay', { onclick: (e) => { if (e.target === overlay) close(); } }, [
      el('div.level-box', {}, [
        el('button.level-close', { onclick: close, 'aria-label': 'Zamknij' }, ['X']),
        el('h2.display', { style: 'margin:0 0 4px;color:#14314f', text: 'Na jakim poziomie jest Twój angielski?' }),
        el('p', { style: 'margin:0 0 16px;color:#46688c', text: 'Dopasuję do niego nasze rozmowy. Zawsze możesz to zmienić.' }),
        el('div.level-options', {}, HOME_LEVELS.map((b) =>
          el('button.level-opt', {
            onclick: () => { store.patchKey('onboarding', { level: b.id }); close(); navigate('#/home'); },
          }, [
            el('span.level-opt__title', { text: b.title }),
            el('span.level-opt__desc', { text: b.desc }),
          ])
        )),
      ]),
    ]);
    document.addEventListener('keydown', onEsc);
    document.body.append(overlay);
  }
}
