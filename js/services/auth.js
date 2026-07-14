// =============================================================
//  Auth — konta użytkowników
// -------------------------------------------------------------
//  Rejestracja i logowanie idą przez nasz backend (Cloud Function),
//  który trzyma konta w Firestore, a hasła jako scrypt-hash.
//  Bez proxy (dev lokalny) działa tryb gościa.
// =============================================================

import { CONFIG } from '../config.js';
import { store } from '../state.js';

const base = () => (CONFIG.GEMINI.proxyBase || '').replace(/\/$/, '');

// Walidacja hasła po stronie apki (serwer i tak sprawdza drugi raz)
export function passwordProblem(p) {
  if (!p || p.length < 8) return 'Hasło musi mieć co najmniej 8 znaków.';
  if (!/[A-ZĄĆĘŁŃÓŚŹŻ]/.test(p)) return 'Hasło musi zawierać wielką literę.';
  if (!/[^A-Za-z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(p)) return 'Hasło musi zawierać znak specjalny (np. ! ? #).';
  return null;
}

async function call(path, payload) {
  const res = await fetch(base() + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Coś poszło nie tak. Spróbuj ponownie.');
  return data;
}

// Ostatnio używane konto na tym urządzeniu (przeżywa wylogowanie) —
// żeby przełączenie kont nie dziedziczyło cudzych postępów.
const LAST_KEY = 'pogadajse.lastAccount';
const lastAccount = () => { try { return localStorage.getItem(LAST_KEY) || ''; } catch { return ''; } };
const rememberAccount = (email) => { try { localStorage.setItem(LAST_KEY, email); } catch {} };

// ---- Trwałość postępów w bazie (poziom, historia, czas) per konto ----
let suppressSync = false;      // wstrzymaj zapis podczas przywracania stanu z bazy
let syncTimer = null;

// Wycinek stanu do bazy — bez surowych czatów (duże) i sampli fonetycznych.
function stateBlob() {
  const s = store.get();
  const { fullChat, trialChat, ...progress } = s.progress || {};
  const phon = s.phonetic || {};
  let profile = phon.profile || null;
  if (profile) { const { samples, ...slim } = profile; profile = slim; }
  return { onboarding: s.onboarding, phonetic: { completed: !!phon.completed, profile }, progress };
}

async function saveStateNow() {
  const u = store.get().user || {};
  if (!u.token || !u.email) return;
  await call('/state/save', { email: u.email, token: u.token, state: stateBlob() });
}

function restoreState(state) {
  if (!state) return;
  try {
    if (state.onboarding) store.patchKey('onboarding', state.onboarding);
    if (state.phonetic) store.patchKey('phonetic', state.phonetic);
    if (state.progress) store.patchKey('progress', state.progress);
  } catch (e) { /* ignore */ }
}

export const auth = {
  // Nowe konto: imię + email + hasło. Świeże konto = CZYSTY start.
  async register({ name = '', email, password }) {
    suppressSync = true;
    const d = await call('/auth/register', { name, email, password });
    store.reset();
    rememberAccount(d.email);
    store.setUser({ id: d.id || '', name: d.name || name || '', email: d.email, token: d.token, provider: 'pogadaj' });
    suppressSync = false;
    return d;
  },

  // Imię ustawiane PO filmie — zapis na serwerze, a lokalnie zawsze
  async setName(name) {
    const u = store.get().user || {};
    store.patchKey('user', { ...u, name });
    if (!u.token || !u.email) return;
    try { await call('/auth/setname', { email: u.email, token: u.token, name }); }
    catch (e) { console.warn('[setname]', e); /* lokalnie już ustawione */ }
  },

  // Logowanie na istniejące konto. Przełączenie na INNE konto niż ostatnio
  // używane na tym urządzeniu czyści lokalne postępy poprzedniego.
  async login({ email, password }) {
    const d = await call('/auth/login', { email, password });
    // Logowanie ZAWSZE czyści lokalne postępy — źródłem prawdy jest konto w bazie,
    // żeby konta i historie nigdy się nie mieszały między użytkownikami/urządzeniami.
    suppressSync = true;
    store.reset();
    rememberAccount(d.email);
    store.setUser({ id: d.id || '', name: d.name, email: d.email, token: d.token, provider: 'pogadaj' });
    restoreState(d.state);                       // poziom, historia, czas, onboarding z bazy
    if (d.profile) { try { store.setPhoneticProfile(d.profile); } catch {} }
    suppressSync = false;
    return d;
  },

  // Zmiana adresu email — serwer przenosi konto i wydaje nowy token sesji
  async setEmail(newEmail) {
    const u = store.get().user || {};
    if (!u.token || !u.email) throw new Error('Zaloguj się ponownie.');
    const d = await call('/auth/setemail', { email: u.email, token: u.token, newEmail });
    rememberAccount(d.email);
    store.patchKey('user', { ...store.get().user, email: d.email, token: d.token });
    return d;
  },

  // Zmiana hasła — wymaga podania obecnego
  async setPassword(password, newPassword) {
    const u = store.get().user || {};
    if (!u.token || !u.email) throw new Error('Zaloguj się ponownie.');
    await call('/auth/setpassword', { email: u.email, token: u.token, password, newPassword });
  },

  // Przypomnienie hasła: wyślij link resetujący na email (serwer zawsze zwraca ok).
  async requestReset(email) {
    return call('/auth/reset-request', { email });
  },

  // Reset hasła: token z maila + nowe hasło.
  async confirmReset(email, token, newPassword) {
    return call('/auth/reset-confirm', { email, token, newPassword });
  },

  // Zapis profilu fonetycznego (problemy z wymową) na koncie w Firestore.
  // Bez surowych sampli — do bazy idzie esencja: challenges/issues/oceny.
  async saveProfile(profile) {
    const u = store.get().user || {};
    if (!u.token || !u.email || !profile) return;
    const { samples, ...slim } = profile;
    await call('/profile/save', { email: u.email, token: u.token, profile: slim });
  },

  // Uruchamia auto-zapis postępów do bazy (poziom, historia, czas) — wywołać raz
  // na starcie apki. Zapisuje z debouncem po każdej zmianie, gdy user zalogowany.
  startStateSync() {
    store.subscribe(() => {
      if (suppressSync) return;
      const u = store.get().user;
      if (!u || !u.token || u.provider !== 'pogadaj') return;
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => saveStateNow().catch(() => {}), 1500);
    });
  },

  // Tryb gościa (dev / podgląd bez konta)
  async signInWithGoogle() {
    const user = { name: 'Gość Kosmonauta', email: 'gosc@pogadaj.se', photo: '', provider: 'local' };
    store.setUser(user);
    return user;
  },

  async signOut() { store.setUser(null); },
  current() { return store.get().user; },
};
