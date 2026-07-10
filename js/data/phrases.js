// =============================================================
//  Odzywki Izabeli — generator luźnych powitań
// -------------------------------------------------------------
//  Dymki składają się z klocków (powitanie + zwrot do ucznia +
//  zajawka), więc ZA KAŻDYM razem brzmią inaczej — bez kosztu
//  zapytań do AI i bez czekania.
// =============================================================

const pick = (a) => a[Math.floor(Math.random() * a.length)];

// płeć z imienia (heurystyka jak w ai.js)
const isFemale = (name) =>
  !!name && !/^(kuba|barnaba|kosma|bonawentura|dyzma|saba)$/i.test(name) && /a$/i.test(name);

const HI = ['Siema', 'No hej', 'Hejka', 'O, jesteś', 'Alright', 'Halo halo', 'No i git'];

const VOCATIVES = (name) => {
  const base = ['mordeczko', 'ziomeczku', isFemale(name) ? 'koleżanko kochana' : 'koleżko'];
  // imię (jeśli znamy) wypada częściej niż ksywki
  return name ? [name, name, name, ...base] : base;
};

const OPENERS = [
  'z rana jak śmietana', 'nie ma spania', 'ciśniemy', 'lecimy z tematem',
  'jazda z tym', 'dawaj dawaj', 'silniki rozgrzane',
];

const PUSHES = ['Jazda z tym!', 'Dawaj dawaj!', 'Ciśniemy!', 'Nie ma spania!', 'Lecimy z tematem!'];

// Krótkie powitanie do dymka na ekranie lekcji, np. „Siema, mordeczko — lecimy z tematem!"
export function greetingHi(name) {
  return `${pick(HI)}, ${pick(VOCATIVES(name))} — ${pick(OPENERS)}!`;
}

// Zachęta na koniec dymka, np. „Dawaj dawaj!"
export function pushLine() { return pick(PUSHES); }

// Powitanie na wejściu w lekcję (mówione od razu, zanim AI się dogra)
export function lessonHello(name) {
  const voc = pick(VOCATIVES(name));
  const mid = pick([
    'Rozgrzewam silniki... dobra, działa',
    'Kawa jest, mikrofon jest',
    'Czekałam na Ciebie',
    'Mikrofon gotowy, ja gotowa',
    'Nie ma spania',
  ]);
  return `${pick(HI)}, ${voc}! ${mid}. ${pick(PUSHES)}`;
}
