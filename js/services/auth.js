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

export const auth = {
  // Nowe konto: imię + email + hasło
  async register({ name, email, password }) {
    const d = await call('/auth/register', { name, email, password });
    store.setUser({ name: d.name, email: d.email, token: d.token, provider: 'pogadaj' });
    return d;
  },

  // Logowanie na istniejące konto
  async login({ email, password }) {
    const d = await call('/auth/login', { email, password });
    store.setUser({ name: d.name, email: d.email, token: d.token, provider: 'pogadaj' });
    return d;
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
