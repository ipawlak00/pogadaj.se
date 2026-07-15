// Zabawne polskie kalki językowe (dosłowne tłumaczenia) — „brechta" + nauka.
// Najpierw śmieszna dosłowna wersja, potem POPRAWNA angielska. Świetne też jako
// bank treści na TikToka (filar „jak Polak kaleczy angielski").
export const KALKI = [
  { pl: 'dziękuję z góry',            wrong: 'thank you from the mountain',      right: 'thanks in advance' },
  { pl: 'czuję do ciebie pociąg',     wrong: 'I feel train to you',              right: "I'm into you" },
  { pl: 'bez ogródek',                wrong: 'without small gardens',            right: 'without beating around the bush' },
  { pl: 'nie rób wiochy',             wrong: "don't make a village",             right: "don't make a scene" },
  { pl: 'już po ptakach',             wrong: "it's after birds",                 right: 'the ship has sailed' },
  { pl: 'musztarda po obiedzie',      wrong: 'mustard after dinner',             right: 'too little, too late' },
  { pl: 'co ma piernik do wiatraka',  wrong: 'what has gingerbread to the windmill', right: 'what does one have to do with the other' },
  { pl: 'nie mój cyrk, nie moje małpy', wrong: 'not my circus, not my monkeys',  right: "not my problem" },
  { pl: 'pierwsze koty za płoty',     wrong: 'first cats behind the fences',     right: 'the first step is the hardest' },
  { pl: 'myśleć o niebieskich migdałach', wrong: 'to think about blue almonds',  right: 'to daydream' },
  { pl: 'bułka z masłem',             wrong: 'a roll with butter',               right: 'a piece of cake' },
  { pl: 'z choinki się urwałeś',      wrong: 'did you fall off the Christmas tree', right: 'are you out of your mind' },
  { pl: 'rzucać grochem o ścianę',    wrong: 'to throw peas against the wall',    right: 'to talk to a brick wall' },
  { pl: 'robić kogoś w konia',        wrong: 'to make someone into a horse',      right: 'to take someone for a ride' },
  { pl: 'spać jak zabity',            wrong: 'to sleep like killed',              right: 'to sleep like a log' },
  { pl: 'wiercić komuś dziurę w brzuchu', wrong: "to drill a hole in someone's belly", right: 'to nag someone' },
  { pl: 'gdzie diabeł mówi dobranoc', wrong: 'where the devil says goodnight',    right: 'in the middle of nowhere' },
  { pl: 'ręka rękę myje',             wrong: 'hand washes hand',                  right: "you scratch my back, I'll scratch yours" },
  { pl: 'flaki z olejem',             wrong: 'tripe with oil',                    right: 'dull as dishwater' },
  { pl: 'zrobić kogoś w balona',      wrong: 'to make someone into a balloon',    right: 'to make a fool of someone' },
];

// Gotowe wtrącenia Izabeli (dymek na ekranie głównym): kalka dla śmiechu + poprawnie.
export const KALKI_LINES = KALKI.map((k) =>
  `Znasz ten klasyk? „${k.pl}" polski umysł tłumaczy na „${k.wrong}". Ale brechta! A poprawnie mówisz „${k.right}".`
);
