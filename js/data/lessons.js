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
    openerPL: "Cześć! Jestem Izabela 👋 Nie martw się — prowadzę po polsku. Spróbujmy razem powiedzieć coś po angielsku. Na rozgrzewkę przywitaj się — spróbuj powiedzieć: „Hello, my name is…”. Śmiało, nie ma złych odpowiedzi!",
    goal: 'Spróbuj powiedzieć kilka prostych zdań po angielsku.',
    suggestions: ['Hello!', 'My name is...', 'I am from Poland', 'I like...'],
  },
  {
    id: 'active-correction',
    num: 2,
    title: 'Aktywna korekta błędów',
    emoji: '🛰️',
    badge: 'free',
    desc: 'Rozmawiamy + małe zadanie z luką. Utknąłeś? Powiedz „Agent, podpowiedz!".',
    type: 'task',
    opener: "Okej, mały trening mówienia! Pokażę Ci zdanie po angielsku, a na dole po polsku — podkreślone słowo to wskazówka. Twoim zadaniem jest POWIEDZIEĆ brakujące słowo. To zdanie z przeszłości, więc kojarz to z czymś, co już się wydarzyło. Śmiało, mów do mikrofonu!",
    task: {
      sentence: 'Yesterday I ___ to the cinema with my friends.',
      sentencePL: 'Wczoraj *poszedłem* do kina z przyjaciółmi.',  // *…* = podkreślone, klik → czyta EN
      answer: 'went',
      fullSentence: 'Yesterday I went to the cinema with my friends.',
      options: [
        { en: 'go', pl: 'iść (teraz, codziennie)' },
        { en: 'went', pl: 'poszedłem / poszłam — wczoraj, w przeszłości' },
        { en: 'gone', pl: '(już) poszło, gdy coś się skończyło' },
      ],
      hintSpoken: 'To było wczoraj — czyli coś, co już się wydarzyło. Pomyśl: chcesz powiedzieć „iść", ale o czymś, co już zrobiłeś. Posłuchaj trzech opcji i wybierz tę, która pasuje do przeszłości.',
      explanation: 'Mówimy o wczoraj, więc o przeszłości — dlatego „went". „Yesterday" (wczoraj) to sygnał, że coś już się wydarzyło.',
    },
    goal: 'Powiedz brakujące słowo, a potem całe zdanie za Izabelą.',
    suggestions: ['Agent, podpowiedz!'],
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
