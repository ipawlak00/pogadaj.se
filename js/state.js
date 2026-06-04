// =============================================================
//  Globalny stan aplikacji + trwałość
// -------------------------------------------------------------
//  Teraz: localStorage. Później: Firestore (przez services/db.js).
//  Reszta apki czyta/zapisuje TYLKO przez te funkcje.
// =============================================================

const KEY = 'pogadajse.state.v1';

const DEFAULT_STATE = {
  user: null,                 // { name, email, photo } po zalogowaniu
  onboarding: {
    completed: false,
    goal: null,               // np. 'work', 'travel', 'exam', 'fun'
    level: null,              // 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
  },
  phonetic: {
    completed: false,
    profile: null,            // { strengths:[], challenges:[], samples:[] }
  },
  progress: {
    lessonsDone: [],          // np. ['icebreaker']
  },
  analyst: [],                // zebrane błędy (przekrojowo)
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return structuredClone(DEFAULT_STATE);
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

const listeners = new Set();
function notify() { listeners.forEach((fn) => fn(state)); }

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  // Aktualizacja zagnieżdżona przez merge na pierwszym poziomie kluczy
  patch(partial) {
    state = { ...state, ...partial };
    persist(); notify();
  },
  patchKey(key, partial) {
    state = { ...state, [key]: { ...state[key], ...partial } };
    persist(); notify();
  },

  // Skróty domenowe
  setUser(user) { this.patch({ user }); },
  completeOnboarding(goal, level) {
    this.patchKey('onboarding', { completed: true, goal, level });
  },
  setPhoneticProfile(profile) {
    this.patchKey('phonetic', { completed: true, profile });
  },
  markLessonDone(id) {
    if (!state.progress.lessonsDone.includes(id)) {
      this.patchKey('progress', { lessonsDone: [...state.progress.lessonsDone, id] });
    }
  },
  addMistake(mistake) {
    state = { ...state, analyst: [...state.analyst, { ...mistake, at: Date.now() }] };
    persist(); notify();
  },
  reset() { state = structuredClone(DEFAULT_STATE); persist(); notify(); },
};
