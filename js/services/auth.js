// =============================================================
//  Auth — logowanie (abstrakcja providera)
// -------------------------------------------------------------
//  'local'    -> symulacja konta Google (bez kluczy)
//  'firebase' -> Firebase Auth + Google Sign-In (szkielet)
// =============================================================

import { CONFIG } from '../config.js';
import { store } from '../state.js';

const localProvider = {
  async signInWithGoogle() {
    // Symulacja — w realu zastąpi to popup Google.
    const user = {
      name: 'Gość Kosmonauta',
      email: 'gosc@pogadaj.se',
      photo: '',
      provider: 'local',
    };
    store.setUser(user);
    return user;
  },
  async signOut() { store.setUser(null); },
  current() { return store.get().user; },
};

// Szkielet Firebase — aktywujemy po podaniu configu.
const firebaseProvider = {
  async signInWithGoogle() {
    throw new Error('Firebase Auth nie jest jeszcze skonfigurowany — uzupełnij CONFIG.FIREBASE.');
  },
  async signOut() { store.setUser(null); },
  current() { return store.get().user; },
};

export const auth = CONFIG.AUTH_PROVIDER === 'firebase' ? firebaseProvider : localProvider;
