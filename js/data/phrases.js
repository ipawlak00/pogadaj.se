// =============================================================
//  Odzywki Izabeli — generator luźnych powitań
// -------------------------------------------------------------
//  Dymki składają się z klocków (powitanie + zwrot do ucznia +
//  zajawka), więc ZA KAŻDYM razem brzmią inaczej — bez kosztu
//  zapytań do AI i bez czekania.
// =============================================================

const pick = (a) => a[Math.floor(Math.random() * a.length)];

// płeć z imienia (heurystyka jak w ai.js)
export const isFemale = (name) =>
  !!name && !/^(kuba|barnaba|kosma|bonawentura|dyzma|saba)$/i.test(name) && /a$/i.test(name);

const HI = ['Siema', 'No hej', 'Hejka', 'O, jesteś', 'Alright', 'Halo halo, tu Londyn', 'No i git', 'Siemandero'];

const VOCATIVES = (name) => {
  const base = ['mordeczko', 'ziomeczku',
    isFemale(name) ? 'koleżanko kochana' : 'koleżko',
    isFemale(name) ? 'wariatko kolorowa' : 'wariacie kolorowy'];
  // imię na równi z ksywkami — bez wałkowania go w kółko
  return name ? [name, ...base] : base;
};

const OPENERS = [
  'nie ma spania', 'ciśniemy', 'lecimy z tematem',
  'jazda z tematem', 'cyk myk i działamy',
];

const PUSHES = ['Jazda z tematem!', 'Ciśniemy!', 'Nie ma spania!', 'Lecimy z tematem!', 'Cyk myk!', 'Wpadaj śmiało!'];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Krótkie powitanie do dymka na ekranie lekcji. Zwykle naturalne, bez sloganu;
// tylko czasem dokleja jedno powiedzonko (nigdy dwa, nigdy w kółko to samo).
export function greetingHi(name) {
  const voc = Math.random() < 0.4 ? `, ${pick(VOCATIVES(name))}` : '';
  const opener = Math.random() < 0.3 ? ` ${cap(pick(OPENERS))}!` : '';
  return `${pick(HI)}${voc}!${opener}`;
}

// Zachęta na koniec dymka, np. „Dawaj dawaj!"
export function pushLine() { return pick(PUSHES); }

// Powitanie na wejściu w lekcję (mówione od razu, zanim AI się dogra).
// Powiedzonko (PUSH) doklejamy tylko czasem — żeby nie brzmieć jak zdarta płyta.
export function lessonHello(name) {
  const voc = Math.random() < 0.45 ? `, ${pick(VOCATIVES(name))}` : '';
  const mid = pick([
    'Kawa jest, mikrofon jest',
    'Czekałam na Ciebie',
    'Mikrofon gotowy, ja gotowa',
    'No i jesteśmy',
    'Dobrze Cię widzieć',
    'Siadaj wygodnie',
  ]);
  const push = Math.random() < 0.35 ? ` ${pick(PUSHES)}` : '';
  return `${pick(HI)}${voc}! ${mid}.${push}`;
}

// Poprawna polska odmiana: 1 minuta, 2-4 minuty, 5-21 minut, 22-24 minuty...
export function minutesWord(n) {
  const abs = Math.abs(n);
  if (abs === 1) return 'minuta';
  const d = abs % 10, dd = abs % 100;
  if (d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14)) return 'minuty';
  return 'minut';
}
