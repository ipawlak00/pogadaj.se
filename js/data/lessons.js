// =============================================================
//  3 darmowe lekcje testowe (Haczyk / lejek sprzedażowy)
// -------------------------------------------------------------
//  1. Rozbicie lodów  — luźna rozmowa, budowanie pewności
//  2. Aktywna korekta — rozmowa + zadanie z luką + Głosowe Koło Ratunkowe
//  3. Cliffhanger     — podsumowanie braków + zachęta do subskrypcji
// =============================================================

export const LESSONS = [
  {
    id: 'icebreaker',
    num: 1,
    title: 'Rozbicie lodów',
    emoji: '🧊',
    badge: 'free',
    desc: 'Luźna pogawędka z Izabelą. Zero stresu, budujemy pewność siebie.',
    type: 'conversation',
    opener: "Hi there! So glad you're here. Tell me — what made you want to learn English? Take your time! 😊",
    goal: 'Powiedz przynajmniej 4 zdania o sobie.',
  },
  {
    id: 'active-correction',
    num: 2,
    title: 'Aktywna korekta błędów',
    emoji: '🛰️',
    badge: 'free',
    desc: 'Rozmawiamy + małe zadanie z luką. Utknąłeś? Powiedz „Agent, podpowiedz!".',
    type: 'task',
    opener: "Okej, troszkę poćwiczymy! Uzupełnij zdanie, a jak utkniesz — wciśnij mikrofon i poproś mnie o pomoc głosem. Let's go!",
    task: {
      prompt: 'Yesterday I ____ to the cinema with my friends.',
      answer: 'went',
      options: ['go', 'went', 'gone', 'going'],
      hintSpoken: 'Pomyśl — to było wczoraj, czyli czas przeszły. Jaka jest druga forma od „go"? 😉',
      explanation: 'Past Simple: „go" → „went". „Yesterday" zawsze sygnalizuje czas przeszły.',
    },
    goal: 'Rozwiąż zadanie — sam albo z głosową podpowiedzią Izabeli.',
  },
  {
    id: 'cliffhanger',
    num: 3,
    title: 'Twój raport z kosmosu',
    emoji: '🚀',
    badge: 'free',
    desc: 'Izabela podsumowuje, co już umiesz i nad czym warto popracować dalej.',
    type: 'summary',
    opener: "Świetna robota! Zebrałam wszystko, co dziś zauważyłam. Zobacz swój raport — i to dopiero początek tego, co możemy razem ogarnąć... 👀",
    goal: 'Zobacz podsumowanie i odblokuj pełny kurs.',
  },
];

export const getLesson = (id) => LESSONS.find((l) => l.id === id);
