// =============================================================
//  3 darmowe lekcje — wieloetapowe, dla początkujących
// -------------------------------------------------------------
//  Każda lekcja = sekwencja krótkich ćwiczeń MÓWIENIA (steps):
//   - { type:'say', en, pl }                  → Izabela czyta EN, mówi znaczenie PL, uczeń powtarza
//   - { type:'fill', sentence, sentencePL,    → uczeń mówi brakujące słowo, potem całe zdanie
//       answer, fullSentence, options, hint }
//  Słowo do podkreślenia w sentencePL oznaczamy *gwiazdkami*.
// =============================================================

export const LESSONS = [
  {
    id: 'first-steps',
    scene: 'assets/izabela/izabela-door.png',
    num: 1,
    title: 'Pierwsze kroki',
    emoji: '',
    badge: 'free',
    desc: 'Najprostsze powitania i pierwsze słowa. Spokojnie, słowo po słowie.',
    type: 'lesson',
    aiTopic: 'Powitania i przedstawianie się: hello, good morning, thank you, please, my name is, nice to meet you, I am from Poland. Bardzo podstawowy poziom.',
    intro: 'Cześć! Jestem Izabela. Zaczynamy zupełnie spokojnie. Ja powiem słowo po angielsku, potem co znaczy po polsku, a Ty powtórzysz za mną. Nie ma złych odpowiedzi! Gotowy? Lecimy!',
    steps: [
      { type: 'say', en: 'Hello', pl: 'Cześć' },
      { type: 'say', en: 'Good morning', pl: 'Dzień dobry' },
      { type: 'say', en: 'Thank you', pl: 'Dziękuję' },
      { type: 'say', en: 'Please', pl: 'Proszę' },
      { type: 'say', en: 'My name is Anna', pl: 'Mam na imię Anna' },
      {
        type: 'fill',
        sentence: 'I ___ from Poland.',
        sentencePL: 'Jestem *z* Polski.',
        answer: 'am',
        fullSentence: 'I am from Poland.',
        options: [
          { en: 'am', pl: 'jestem (ja)' },
          { en: 'is', pl: 'jest (on/ona)' },
          { en: 'are', pl: 'jesteś / są' },
        ],
        hint: 'Mówisz o sobie — „ja jestem". Po angielsku „I" łączymy z „am".',
      },
      { type: 'say', en: 'Nice to meet you', pl: 'Miło Cię poznać' },
    ],
  },

  {
    id: 'daily-phrases',
    scene: 'assets/scenes/scene-01.jpg',
    num: 2,
    title: 'Codzienne zwroty',
    emoji: '',
    badge: 'free',
    desc: 'Zwroty na co dzień: jak się masz, co lubisz, do zobaczenia.',
    type: 'lesson',
    aiTopic: 'Codzienne zwroty: how are you, I am fine, I am tired, I like..., see you later, goodbye. Krótkie pytania o samopoczucie i upodobania. Poziom podstawowy.',
    intro: 'Super, że jesteś! Teraz kilka zwrotów, których używa się codziennie. Tak samo: słuchasz mnie i powtarzasz. Dasz radę!',
    steps: [
      { type: 'say', en: 'How are you?', pl: 'Jak się masz?' },
      { type: 'say', en: 'I am fine', pl: 'Mam się dobrze' },
      { type: 'say', en: 'I am tired', pl: 'Jestem zmęczony' },
      { type: 'say', en: 'I like coffee', pl: 'Lubię kawę' },
      {
        type: 'fill',
        sentence: 'I ___ tea.',
        sentencePL: '*Lubię* herbatę.',
        answer: 'like',
        fullSentence: 'I like tea.',
        options: [
          { en: 'like', pl: 'lubię' },
          { en: 'have', pl: 'mam' },
          { en: 'want', pl: 'chcę' },
        ],
        hint: 'Coś Ci smakuje, sprawia przyjemność — czyli to „lubisz".',
      },
      { type: 'say', en: 'See you later', pl: 'Do zobaczenia' },
      { type: 'say', en: 'Goodbye', pl: 'Do widzenia' },
    ],
  },

  {
    id: 'simple-sentences',
    scene: 'assets/scenes/scene-12.jpg',
    num: 3,
    title: 'Proste zdania',
    emoji: '',
    badge: 'free',
    desc: 'Krótkie, przydatne zdania — poprosić, zapytać, powiedzieć o sobie.',
    type: 'lesson',
    aiTopic: 'Proste, przydatne zdania w podróży i na co dzień: I want water, I am hungry, where is the toilet, how much is it, can you help me, proste zdania w czasie przeszłym (yesterday I went...). Poziom podstawowy.',
    intro: 'Lecimy dalej! Teraz całe krótkie zdania, które naprawdę przydają się w podróży i na co dzień. Słuchasz i powtarzasz za mną.',
    steps: [
      { type: 'say', en: 'I want water', pl: 'Chcę wody' },
      { type: 'say', en: 'I am hungry', pl: 'Jestem głodny' },
      {
        type: 'fill',
        sentence: 'Yesterday I ___ to the shop.',
        sentencePL: 'Wczoraj *poszedłem* do sklepu.',
        answer: 'went',
        fullSentence: 'Yesterday I went to the shop.',
        options: [
          { en: 'go', pl: 'iść (teraz, codziennie)' },
          { en: 'went', pl: 'poszedłem / poszłam (wczoraj)' },
          { en: 'gone', pl: '(już) poszło, skończone' },
        ],
        hint: 'To było wczoraj — czyli coś, co już się wydarzyło, w przeszłości.',
      },
      { type: 'say', en: 'Where is the toilet?', pl: 'Gdzie jest toaleta?' },
      { type: 'say', en: 'How much is it?', pl: 'Ile to kosztuje?' },
      { type: 'say', en: 'Can you help me?', pl: 'Możesz mi pomóc?' },
      { type: 'say', en: 'Have a nice day', pl: 'Miłego dnia' },
    ],
  },
];

// ---- Zestaw B1/B2 — rozmowa już się klei, szlifujemy swobodę ----
export const LESSONS_MID = [
  {
    id: 'small-talk',
    scene: 'assets/scenes/scene-09.jpg',
    num: 1,
    title: 'Small talk bez spiny',
    badge: 'free',
    desc: 'Zagadać do kogoś naturalnie — pogoda, weekend, praca. I jak nie brzmieć jak robot.',
    type: 'lesson',
    aiTopic: 'Small talk na poziomie B1/B2: naturalne rozpoczynanie rozmowy, pytania podtrzymujące (How come? What was that like?), reagowanie na odpowiedzi, unikanie kalki z polskiego. Rozmowa głównie po angielsku, korekty po polsku.',
    intro: 'Dziś uczymy się gadać o niczym — czyli o wszystkim. Small talk otwiera każde drzwi!',
    steps: [
      { type: 'say', en: 'How was your weekend?', pl: 'Jak minął weekend?' },
      { type: 'say', en: 'I have been super busy lately', pl: 'Ostatnio jestem strasznie zajęty' },
      { type: 'say', en: 'What do you do for a living?', pl: 'Czym się zajmujesz zawodowo?' },
      { type: 'say', en: 'That sounds interesting, tell me more', pl: 'Brzmi ciekawie, opowiedz mi więcej' },
    ],
  },
  {
    id: 'daily-story',
    scene: 'assets/scenes/scene-14.jpg',
    num: 2,
    title: 'Opowiedz swój dzień',
    badge: 'free',
    desc: 'Płynne opowiadanie o tym, co się wydarzyło — czasy przeszłe w praktyce, bez tabelek.',
    type: 'lesson',
    aiTopic: 'Opowiadanie o swoim dniu i wydarzeniach (B1/B2): Past Simple vs Present Perfect w praktyce, łączniki (so, then, actually, it turned out), naturalny storytelling. Uczeń opowiada, Izabela dopytuje i koryguje.',
    intro: 'Dziś Ty gadasz, ja słucham. Opowiesz mi swój dzień po angielsku — a ja podkręcę Twoją opowieść.',
    steps: [
      { type: 'say', en: 'This morning I woke up late', pl: 'Dziś rano zaspałem' },
      { type: 'say', en: 'It turned out to be a great day', pl: 'Okazało się, że to świetny dzień' },
      { type: 'say', en: 'I have never done that before', pl: 'Nigdy wcześniej tego nie robiłem' },
    ],
  },
  {
    id: 'real-situations',
    scene: 'assets/scenes/scene-08.jpg',
    num: 3,
    title: 'Sytuacje z życia',
    badge: 'free',
    desc: 'Reklamacja, rezerwacja, nieporozumienie — angielski, kiedy coś idzie nie tak.',
    type: 'lesson',
    aiTopic: 'Radzenie sobie w realnych sytuacjach (B1/B2): reklamacja w sklepie, zmiana rezerwacji, prośba o wyjaśnienie (Could you clarify...?), uprzejma asertywność. Odgrywanie scenek, Izabela gra drugą stronę.',
    intro: 'Dziś scenki z życia — coś poszło nie tak i trzeba to ogarnąć po angielsku. Ja gram obsługę, Ty klienta!',
    steps: [
      { type: 'say', en: 'Excuse me, there is a problem with my order', pl: 'Przepraszam, jest problem z moim zamówieniem' },
      { type: 'say', en: 'Could you clarify what you mean?', pl: 'Czy możesz wyjaśnić, co masz na myśli?' },
      { type: 'say', en: 'I would like to change my reservation', pl: 'Chciałbym zmienić rezerwację' },
    ],
  },
];

// ---- Zestaw C1 — płynność jest, polerujemy detale i styl ----
export const LESSONS_HIGH = [
  {
    id: 'strong-opinions',
    scene: 'assets/scenes/scene-10.jpg',
    num: 1,
    title: 'Opinia z pazurem',
    badge: 'free',
    desc: 'Przekonująco bronić zdania, niuansować, grzecznie się nie zgadzać.',
    type: 'lesson',
    aiTopic: 'Dyskusja na poziomie C1: wyrażanie i obrona opinii, hedging (arguably, to some extent), grzeczne kontrargumenty (I see your point, but...), unikanie zbyt bezpośrednich kalk z polskiego. Izabela podrzuca kontrowersyjne (lekkie) tematy i gra adwokata diabła.',
    intro: 'Dziś się pospieramy — kulturalnie! Ja podrzucam temat i gram adwokata diabła, Ty bronisz swojego zdania.',
    steps: [
      { type: 'say', en: 'I see your point, but I strongly disagree', pl: 'Rozumiem Twój punkt widzenia, ale zdecydowanie się nie zgadzam' },
      { type: 'say', en: 'That is arguably the biggest challenge we face', pl: 'To prawdopodobnie największe wyzwanie, przed jakim stoimy' },
    ],
  },
  {
    id: 'work-english',
    scene: 'assets/scenes/scene-07.jpg',
    num: 2,
    title: 'Angielski w robocie',
    badge: 'free',
    desc: 'Spotkania, prezentacje, feedback — brzmieć profesjonalnie, nie sztywno.',
    type: 'lesson',
    aiTopic: 'Profesjonalny angielski (C1): prowadzenie spotkania, dyplomatyczny feedback (I was wondering if we could...), podsumowywanie, różnica między formalnym a naturalnym tonem. Scenki biurowe, Izabela gra współpracownika.',
    intro: 'Wchodzimy w tryb biurowy — ale bez korpomowy. Nauczysz się brzmieć profesjonalnie i po ludzku naraz.',
    steps: [
      { type: 'say', en: 'Let me summarize what we have agreed on', pl: 'Podsumuję, co ustaliliśmy' },
      { type: 'say', en: 'I was wondering if we could revisit this decision', pl: 'Zastanawiam się, czy moglibyśmy wrócić do tej decyzji' },
    ],
  },
  {
    id: 'idioms-nuance',
    scene: 'assets/scenes/scene-02.jpg',
    num: 3,
    title: 'Idiomy i niuanse',
    badge: 'free',
    desc: 'Brzmieć jak native: idiomy, phrasale i słowa, których podręczniki nie uczą.',
    type: 'lesson',
    aiTopic: 'Idiomy, phrasal verbs i niuanse znaczeniowe (C1): naturalne kolokwializmy, różnice rejestru, fałszywi przyjaciele, humor językowy. Izabela wplata idiomy w rozmowę i prosi ucznia o użycie ich we własnych zdaniach.',
    intro: 'Dziś smaczki — idiomy i zwroty, po których brzmi się jak swój. Będzie się działo!',
    steps: [
      { type: 'say', en: 'It is not my cup of tea, to be honest', pl: 'Szczerze mówiąc, to nie moja bajka' },
      { type: 'say', en: 'We will figure it out as we go', pl: 'Rozgryziemy to po drodze' },
    ],
  },
];

// Sceny (tła) przeplatające się przy lekcjach/zadaniach — Twoje grafiki.
export const SCENES = [
  'assets/scenes/scene-01.jpg', 'assets/scenes/scene-02.jpg', 'assets/scenes/scene-03.jpg',
  'assets/scenes/scene-04.jpg', 'assets/scenes/scene-05.jpg',
  'assets/scenes/scene-07.jpg', 'assets/scenes/scene-08.jpg', 'assets/scenes/scene-09.jpg',
  'assets/scenes/scene-10.jpg', 'assets/scenes/scene-11.jpg', 'assets/scenes/scene-12.jpg',
  'assets/scenes/scene-14.jpg',
];

// ---- Dobór zestawu lekcji do poziomu ucznia ----
export const LESSON_SETS = { basic: LESSONS, mid: LESSONS_MID, high: LESSONS_HIGH };
export const setForLevel = (lvl) =>
  ['A1', 'A2'].includes(lvl) ? 'basic' : ['B1', 'B2'].includes(lvl) ? 'mid' : lvl ? 'high' : 'basic';
export const getLessonsForLevel = (lvl) => LESSON_SETS[setForLevel(lvl)];

// Portretowe kadry Izabeli do widoku lekcji (blisko, od pasa w górę)
export const LESSON_PORTRAITS = ['assets/scenes/scene-05.jpg', 'assets/scenes/scene-09.jpg', 'assets/scenes/scene-10.jpg'];

// Ekran główny pełnej wersji: tło zmienia się przy KAŻDYM wejściu (nie w czasie).
// Każda scena ma własne pozycje przycisków i dymka, tak dobrane, żeby NIGDY
// nie zasłaniać twarzy Izabeli ani kotów (różne kadry = różne bezpieczne miejsca).
export const HOME_SCENES = [
  { // warsztat: Izabela na środku, Peja śpi w lewym dole, Kocin na kablach z prawej
    src: 'assets/scenes/scene-15.jpg',
    focus: '50% 26%',                 // kadrowanie tła (twarz Izabeli widoczna na telefonie)
    controls: 'left:50%; bottom:4%; transform:translateX(-50%); align-items:center',
    bubble: 'left:2%; top:40%',
  },
  { // relaks: Izabela z prawej, kot na kolanach na środku, Kocin na półce w prawym górnym rogu
    src: 'assets/scenes/scene-16.jpg',
    focus: '68% 26%',
    controls: 'left:2%; bottom:6%; align-items:center',
    bubble: 'left:2%; top:38%',
  },
];

// Pełna wersja: miesięczny budżet rozmów (w minutach)
export const FULL_MONTH_MINUTES = 15 * 60;   // 15 godzin

export function getFullLesson(level) {
  const band = setForLevel(level);
  const base = LESSON_SETS[band][0];
  return {
    id: 'full',
    num: 1,
    title: 'Lekcja z Izabelą',
    badge: 'full',
    desc: 'Swobodna rozmowa dopasowana do Twojego poziomu.',
    type: 'lesson',
    scene: null,                                  // portret losowany w lekcji
    aiTopic: TRIAL_TOPICS[band],
    intro: base.intro,
    steps: base.steps,
  };
}

export const getLesson = (id) =>
  [...LESSONS, ...LESSONS_MID, ...LESSONS_HIGH].find((l) => l.id === id);

// ---- JEDNA lekcja próbna: 45 minut rozmowy do zużycia po kawałku ----
// Temat dobiera się do poziomu; Izabela prowadzi swobodnie i adaptacyjnie.
export const TRIAL_MINUTES = 45;

const TRIAL_TOPICS = {
  basic: 'Swobodna pierwsza rozmowa dla początkujących: powitania, przedstawianie się, codzienne zwroty, proste zdania o sobie. Ucz krok po kroku, bardzo prostymi frazami, płynnie przechodź między podtematami wg zainteresowań ucznia.',
  mid: 'Swobodna rozmowa na poziomie B1/B2: small talk, opowiadanie o swoim dniu i planach, realne sytuacje (sklep, podróż, praca). Płynnie zmieniaj podtematy wg zainteresowań ucznia, koryguj naturalnie.',
  high: 'Swobodna rozmowa na poziomie C1: dyskusja z wyrażaniem opinii, angielski zawodowy, idiomy i niuanse. Graj partnera do rozmowy z charakterem, podbijaj poziom, łap za słówka.',
};

export function getTrialLesson(level) {
  const band = setForLevel(level);
  const base = LESSON_SETS[band][0];               // kroki awaryjne (bez AI)
  return {
    id: 'trial',
    num: 1,
    title: 'Lekcja próbna',
    badge: 'free',
    desc: `${TRIAL_MINUTES} minut rozmowy z Izabelą — do wykorzystania po kawałku, kiedy chcesz.`,
    type: 'lesson',
    scene: base.scene,
    aiTopic: TRIAL_TOPICS[band],
    intro: base.intro,
    steps: base.steps,
  };
}
