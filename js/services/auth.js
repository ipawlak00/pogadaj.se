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

export const auth = {
  // Nowe konto: email + hasło (imię Izabela pozna po filmie).
  // Świeże konto = CZYSTY start (zero odziedziczonych postępów z urządzenia).
  async register({ email, password }) {
    const d = await call('/auth/register', { name: '', email, password });
    store.reset();
    rememberAccount(d.email);
    store.setUser({ id: d.id || '', name: d.name || '', email: d.email, token: d.token, provider: 'pogadaj' });
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
    const prev = store.get().user?.email || lastAccount();
    if (prev && prev !== d.email) store.reset();
    rememberAccount(d.email);
    store.setUser({ id: d.id || '', name: d.name, email: d.email, token: d.token, provider: 'pogadaj' });
    // Profil wymowy z bazy — Izabela pamięta problemy ucznia także po zmianie urządzenia
    if (d.profile) { try { store.setPhoneticProfile(d.profile); } catch {} }
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

  // Zapis profilu fonetycznego (problemy z wymową) na koncie w Firestore.
  // Bez surowych sampli — do bazy idzie esencja: challenges/issues/oceny.
  async saveProfile(profile) {
    const u = store.get().user || {};
    if (!u.token || !u.email || !profile) return;
    const { samples, ...slim } = profile;
    await call('/profile/save', { email: u.email, token: u.token, profile: slim });
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
