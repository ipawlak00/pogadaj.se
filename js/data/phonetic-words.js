// =============================================================
//  Paszport Fonetyczny, 20 słówek kalibracyjnych
// -------------------------------------------------------------
//  Dobrane tak, by przetestować dźwięki najtrudniejsze dla Polaków:
//  TH (θ/ð), R (angielskie), W vs V, samogłoski ɪ vs iː, æ, schwa ə,
//  ŋ, dyftongi, nieme litery, zbitki spółgłoskowe, końcówki -ed/-s.
//  Każde słowo ma "focus", wskazówkę dla analizy fonetycznej.
// =============================================================

export const PHONETIC_WORDS = [
  { word: 'think',     ipa: '/θɪŋk/',        pl: 'myśleć',       focus: 'th-unvoiced', hint: 'Język między zębami, nie „fink" ani „sink".' },
  { word: 'this',      ipa: '/ðɪs/',         pl: 'to, ten',      focus: 'th-voiced',   hint: 'Dźwięczne „TH", nie „dis" ani „zis".' },
  { word: 'three',     ipa: '/θriː/',        pl: 'trzy',         focus: 'th+r',        hint: 'TH + angielskie R w jednym.' },
  { word: 'weather',   ipa: '/ˈweðər/',      pl: 'pogoda',       focus: 'w+th',        hint: '„W" wargami, nie „v".' },
  { word: 'very',      ipa: '/ˈveri/',       pl: 'bardzo',       focus: 'v',           hint: 'Górne zęby na dolnej wardze, „v", nie „w".' },
  { word: 'world',     ipa: '/wɜːrld/',      pl: 'świat',        focus: 'r+l-cluster', hint: 'Miękkie R + L na końcu.' },
  { word: 'rural',     ipa: '/ˈrʊrəl/',      pl: 'wiejski',      focus: 'r',           hint: 'Dwa angielskie „R", bez polskiego twardego „r".' },
  { word: 'ship',      ipa: '/ʃɪp/',         pl: 'statek',       focus: 'short-i',     hint: 'Krótkie „ɪ", nie „sheep".' },
  { word: 'sheep',     ipa: '/ʃiːp/',        pl: 'owca',         focus: 'long-i',      hint: 'Długie „iː", przeciwieństwo „ship".' },
  { word: 'cat',       ipa: '/kæt/',         pl: 'kot',          focus: 'ae',          hint: 'Otwarte „æ", pomiędzy „a" i „e".' },
  { word: 'comfortable', ipa: '/ˈkʌmftəbəl/', pl: 'wygodny',     focus: 'schwa',       hint: 'Schwa i skróty, nie literuj „com-for-ta-ble".' },
  { word: 'thirsty',   ipa: '/ˈθɜːrsti/',    pl: 'spragniony',   focus: 'th+r+s',      hint: 'TH + długie ER.' },
  { word: 'singing',   ipa: '/ˈsɪŋɪŋ/',      pl: 'śpiewanie',    focus: 'ng',          hint: 'Nosowe „ŋ", bez twardego „g" na końcu.' },
  { word: 'house',     ipa: '/haʊs/',        pl: 'dom',          focus: 'diphthong-au',hint: 'Dyftong „aʊ".' },
  { word: 'phone',     ipa: '/foʊn/',        pl: 'telefon',      focus: 'diphthong-ou',hint: '„PH" = „f", dyftong „oʊ".' },
  { word: 'knife',     ipa: '/naɪf/',        pl: 'nóż',          focus: 'silent-k',    hint: 'Nieme „K".' },
  { word: 'Wednesday', ipa: '/ˈwenzdeɪ/',    pl: 'środa',        focus: 'silent',      hint: 'Nieme „D" w środku, „Wenzdej".' },
  { word: 'asked',     ipa: '/æskt/',        pl: 'zapytał(a)',   focus: 'ed-ending',   hint: 'Końcówka „-ed" jako „t".' },
  { word: 'clothes',   ipa: '/kloʊðz/',      pl: 'ubrania',      focus: 'th+cluster',  hint: 'Trudna zbitka „ðz" na końcu.' },
  { word: 'squirrel',  ipa: '/ˈskwɜːrəl/',   pl: 'wiewiórka',    focus: 'cluster+r',   hint: 'Zbitka „skw" + R, klasyczny łamacz języka.' },
];
