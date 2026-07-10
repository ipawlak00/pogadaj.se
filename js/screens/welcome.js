import { el, toast, navigate } from '../ui.js';
import { auth } from '../services/auth.js';
import { store } from '../state.js';

// Ekran logowania / powitania — wg projektu z Firebase (czerń + pomarańcz).
// NA TERAZ: każdy przycisk logowania wpuszcza jako gościa, by przejrzeć aplikację.
export function renderWelcome(mount) {
  const email = el('input', { type: 'email', placeholder: 'twój@email.com', autocomplete: 'email' });
  const pass = el('input', { type: 'password', placeholder: 'Hasło', autocomplete: 'current-password' });

  mount.append(
    el('div.auth-wrap.fade-in', {}, [
      el('h1.auth-title', {}, ['POGADAJ', el('span.planet-dot'), 'SE']),
      el('div.auth-sub', { text: 'GADAJ I UCZ SIĘ ANGIELSKIEGO Z IZABELĄ!' }),

      el('div.auth-card', {}, [
        el('div.field', {}, [ el('label', { text: 'Email' }), email ]),
        el('div.field', {}, [ el('label', { text: 'Hasło' }), pass ]),
        el('button.btn.btn--primary.auth-submit', { onclick: enterAsGuest }, ['Zaloguj się']),
        el('button.btn.auth-create', { style: 'margin-top:14px', onclick: createAccount }, ['Stwórz darmowe konto']),
      ]),

      el('div.auth-footer', { html: 'POWERED BY <b>IZABELACODE</b>' }),
      el('button.auth-reset', {
        onclick: () => { store.reset(); location.hash = '#/'; location.reload(); },
        title: 'Czyści postępy i ustawienia zapisane na tym urządzeniu',
      }, ['Zacznij od nowa']),
    ])
  );

  async function enterAsGuest() {
    try {
      await auth.signInWithGoogle();   // tryb local → tworzy konto-gościa
      toast('Miło Cię widzieć!');
      // Logowanie: jeśli onboarding już był (i znamy imię), leć prosto dalej.
      const st = store.get();
      const known = st.onboarding.completed && st.user?.name && !/^gość$/i.test(st.user.name);
      navigate(known ? '#/intro' : '#/onboarding');
    } catch (e) {
      toast(e.message || 'Coś poszło nie tak', 'error');
    }
  }

  // Nowe konto = ZAWSZE pełne poznanie się (imię, cel, poziom)
  async function createAccount() {
    try {
      await auth.signInWithGoogle();
      navigate('#/onboarding');
    } catch (e) {
      toast(e.message || 'Coś poszło nie tak', 'error');
    }
  }
}
