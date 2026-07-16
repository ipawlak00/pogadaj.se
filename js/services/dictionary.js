// =============================================================
//  Słownik — Free Dictionary API (dictionaryapi.dev, dane z Wiktionary).
//  Darmowe, bez klucza, z CORS. Daje prawdziwe IPA, audio wymowy native
//  speakera oraz definicje/przykłady. Używamy do rzetelnej wymowy słów.
// =============================================================

const BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const cache = new Map();   // słowo -> wynik (lub null), żeby nie pytać dwa razy

// Wyszukaj słowo. Zwraca { word, ipa, audio, meanings } albo null.
export async function lookup(word) {
  const w = String(word || '').trim().toLowerCase().replace(/[^a-z''-]/g, '');
  if (!w) return null;
  if (cache.has(w)) return cache.get(w);
  try {
    const r = await fetch(BASE + encodeURIComponent(w));
    if (!r.ok) { cache.set(w, null); return null; }
    const data = await r.json();
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry) { cache.set(w, null); return null; }

    let ipa = entry.phonetic || '';
    let audio = '';
    for (const p of (entry.phonetics || [])) {
      if (!ipa && p.text) ipa = p.text;
      if (!audio && p.audio) audio = p.audio;
    }
    if (audio.startsWith('//')) audio = 'https:' + audio;   // czasem URL bez schematu

    const meanings = (entry.meanings || []).slice(0, 3).map((m) => ({
      partOfSpeech: m.partOfSpeech || '',
      definition: m.definitions?.[0]?.definition || '',
      example: m.definitions?.[0]?.example || '',
    }));

    const res = { word: entry.word || w, ipa, audio, meanings };
    cache.set(w, res);
    return res;
  } catch (e) {
    cache.set(w, null);
    return null;
  }
}

// Sam zapis IPA dla słowa (albo '').
export async function ipaOf(word) {
  const r = await lookup(word);
  return r?.ipa || '';
}

// Odtwórz nagranie native speakera dla słowa. Zwraca true, jeśli się udało.
export async function playNative(word) {
  const r = await lookup(word);
  if (!r?.audio) return false;
  try {
    const a = new Audio(r.audio);
    await a.play();
    return true;
  } catch (e) {
    return false;
  }
}

export const dictionary = { lookup, ipaOf, playNative };
