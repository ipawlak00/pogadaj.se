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
    num: 1,
    title: 'Pierwsze kroki',
    emoji: '👋',
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
    num: 2,
    title: 'Codzienne zwroty',
    emoji: '☕',
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
    num: 3,
    title: 'Proste zdania',
    emoji: '💬',
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

export const getLesson = (id) => LESSONS.find((l) => l.id === id);
