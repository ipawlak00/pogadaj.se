// =============================================================
//  Rzetelna baza referencyjna angielskiego (fakty, nie tekst słownika).
//  Skompilowana pod polskiego ucznia: dźwięki IPA, pułapki gramatyczne,
//  false friends, idiomy. Wstrzykiwana Izabeli do kontekstu, żeby uczyła
//  spójnie i poprawnie, a nie zgadywała.
// =============================================================

// Dźwięki, z którymi Polacy mają najczęściej problem (IPA + przykład + wskazówka)
export const IPA_FOCUS = [
  { ipa: 'θ', example: 'think, three',  tip: 'bezdźwięczne TH: język między zębami, dmuchasz; NIE „t" ani „f".' },
  { ipa: 'ð', example: 'this, mother',  tip: 'dźwięczne TH: język między zębami, z głosem; NIE „d" ani „z".' },
  { ipa: 'w', example: 'water, west',   tip: 'zaokrąglone usta jak przy „u"; NIE polskie „w" (v).' },
  { ipa: 'v', example: 'very, video',   tip: 'górne zęby na dolnej wardze; odróżniaj od „w".' },
  { ipa: 'ɪ', example: 'ship, sit',     tip: 'krótkie, rozluźnione „i"; różne od długiego iː.' },
  { ipa: 'iː', example: 'sheep, see',   tip: 'długie, napięte „ii".' },
  { ipa: 'æ', example: 'cat, bad',      tip: 'szerokie „a" między polskim „a" i „e".' },
  { ipa: 'ə', example: 'about, sofa',   tip: 'schwa: leniwe, nijakie „y/e" w sylabie nieakcentowanej.' },
  { ipa: 'ŋ', example: 'sing, thing',   tip: 'nosowe „ng"; NIE wymawiaj twardego „g" na końcu.' },
  { ipa: 'h', example: 'house, hello',  tip: 'wyraźny przydech; nie połykaj „h".' },
  { ipa: 'r', example: 'red, right',    tip: 'angielskie „r" bez wibracji języka; język cofnięty, nie polskie „r".' },
];

// Najczęstsze pułapki gramatyczne dla Polaków
export const GRAMMAR_TRAPS = [
  'Przedimki a/an/the: polski ich nie ma, ale w angielskim są obowiązkowe. „a/an" = jeden z wielu (nowy), „the" = ten konkretny (znany).',
  'Present Perfect vs Past Simple: Past Simple = skończone, z czasem (yesterday, in 2020). Present Perfect (have/has + 3. forma) = skutek teraz, bez konkretnego czasu (I have done it).',
  'Since vs for: „since" + punkt w czasie (since Monday), „for" + długość (for two hours).',
  'Szyk zdania jest STAŁY: podmiot-orzeczenie-dopełnienie (SVO). Nie przestawiaj jak w polskim.',
  'Trzecia osoba l. poj. dodaje -s: he works, she goes. Bardzo częsty błąd.',
  'Make vs do: „do" = czynności/obowiązki (do homework, do the dishes), „make" = tworzenie (make a cake, make a decision).',
  'Policzalne/niepoliczalne: „much/little" + niepoliczalne (much water), „many/few" + policzalne (many cars).',
  'Podwójne przeczenie jest błędne: „I don\'t know anything" (nie: I don\'t know nothing).',
];

// „Fałszywi przyjaciele" — słowa, które brzmią jak polskie, a znaczą co innego
export const FALSE_FRIENDS = [
  { en: 'actually', means: 'w rzeczywistości / właściwie', notPl: 'NIE „aktualnie" (to: currently)' },
  { en: 'eventually', means: 'w końcu / ostatecznie', notPl: 'NIE „ewentualnie" (to: possibly / if need be)' },
  { en: 'sympathetic', means: 'współczujący', notPl: 'NIE „sympatyczny" (to: nice / friendly)' },
  { en: 'fabric', means: 'tkanina', notPl: 'NIE „fabryka" (to: factory)' },
  { en: 'ordinary', means: 'zwykły', notPl: 'NIE „ordynarny" (to: rude / vulgar)' },
  { en: 'sensible', means: 'rozsądny', notPl: 'NIE „sensowny/wrażliwy" (wrażliwy to: sensitive)' },
  { en: 'lecture', means: 'wykład', notPl: 'NIE „lektura" (to: reading)' },
  { en: 'pension', means: 'emerytura', notPl: 'NIE „pensja" (to: salary)' },
];

// Popularne idiomy (znaczenie + rejestr) — fakty, nie tekst słownika
export const IDIOMS = [
  { idiom: 'a piece of cake', means: 'coś bardzo łatwego' },
  { idiom: 'break a leg', means: 'powodzenia (do występu)' },
  { idiom: 'hit the books', means: 'zabrać się ostro do nauki' },
  { idiom: 'under the weather', means: 'czuć się kiepsko / być chorym' },
  { idiom: 'once in a blue moon', means: 'bardzo rzadko' },
  { idiom: 'cost an arm and a leg', means: 'kosztować fortunę' },
  { idiom: 'the ball is in your court', means: 'teraz Twój ruch' },
  { idiom: 'bite the bullet', means: 'zacisnąć zęby i zrobić coś trudnego' },
];

// Kompaktowa „ściąga" wstrzykiwana do promptu Izabeli — zwięzła, ale rzetelna.
export const ENGLISH_CHEATSHEET = `RZETELNA BAZA (opieraj korekty na tym, nie zgaduj):
Dźwięki trudne dla Polaków: ${IPA_FOCUS.map((s) => `${s.ipa} (${s.example})`).join(', ')}.
Pułapki gramatyczne: ${GRAMMAR_TRAPS.join(' ')}
Fałszywi przyjaciele: ${FALSE_FRIENDS.map((f) => `${f.en} = ${f.means} (${f.notPl})`).join('; ')}.
Gdy uczeń używa źle któregoś z tych słów/reguł — łap to i tłumacz krótko po polsku. Podając wymowę słowa, możesz odwołać się do jego zapisu IPA.`;
