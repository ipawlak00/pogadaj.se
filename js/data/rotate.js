import { store } from '../state.js';

// Losowanie BEZ POWTÓREK dla danego użytkownika. Izabela nie powtarza tej samej
// kwestii, dopóki nie wyczerpie całej puli — wtedy zaczyna od nowa.
// Zużyte kwestie trzymamy w progress.usedLines[category] (per konto, sync do bazy).
export function pickFresh(category, arr) {
  if (!arr || !arr.length) return '';
  const all = store.get().progress.usedLines || {};
  // tylko wpisy nadal obecne w puli (odporne na zmiany treści = brak puchnięcia)
  const used = (all[category] || []).filter((x) => arr.includes(x));
  let fresh = arr.filter((x) => !used.includes(x));
  let base = used;
  if (!fresh.length) { fresh = arr.slice(); base = []; }   // wyczerpane → reset
  const choice = fresh[Math.floor(Math.random() * fresh.length)];
  store.patchKey('progress', { usedLines: { ...all, [category]: [...base, choice] } });
  return choice;
}
