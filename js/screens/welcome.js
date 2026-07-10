import { el, toast, navigate } from '../ui.js';
import { auth } from '../services/auth.js';
import { store } from '../state.js';

// Ekran logowania / powitania.
// „Zaloguj się" = istniejące konto (email + hasło, sprawdzane na serwerze).
// „Stwórz darmowe konto" = poznanie się z Izabelą (imię, cel, poziom) + rejestracja.
export function renderWelcome(mount) {
  const email = el('input', { type: 'email', placeholder: 'twój@email.com', autocomplete: 'email' });
  const pass = el('input', { type: 'password', placeholder: 'Hasło', autocomplete: 'current-password' });
  const loginBtn = el('button.btn.btn--primary.auth-submit', { onclick: login }, ['Zaloguj się']);

  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });

  mount.append(
    el('div.auth-wrap.fade-in', {}, [
      el('h1.auth-title', {}, ['POGADAJ', el('span.planet-dot'), 'SE']),
      el('div.auth-sub', { text: 'GADAJ I UCZ SIĘ ANGIELSKIEGO Z IZABELĄ!' }),

      el('div.auth-card', {}, [
        el('div.field', {}, [ el('label', { text: 'Email' }), email ]),
        el('div.field', {}, [ el('label', { text: 'Hasło' }), pass ]),
        loginBtn,
        el('button.btn.auth-create', { style: 'margin-top:14px', onclick: createAccount }, ['Stwórz darmowe konto']),
      ]),

      el('div.auth-footer', { html: 'POWERED BY <b>IZABELACODE</b>' }),
      el('button.auth-reset', {
        onclick: () => { store.reset(); location.hash = '#/'; location.reload(); },
        title: 'Czyści postępy i ustawienia zapisane na tym urządzeniu',
      }, ['Zacznij od nowa']),
    ])
  );

  // Nowe konto = ZAWSZE czysta karta: wylogowanie + zerowy stan,
  // żeby onboarding nie przejął imienia/postępów poprzedniego konta.
  function createAccount() {
    auth.signOut();
    store.reset();
    navigate('#/onboarding');
  }

  async function login() {
    const e = email.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast('Podaj poprawny adres email', 'error'); return; }
    if (!pass.value) { toast('Podaj hasło', 'error'); return; }
    loginBtn.disabled = true; loginBtn.textContent = 'Loguję…';
    try {
      await auth.login({ email: e, password: pass.value });
      toast('Miło Cię widzieć!');
      const st = store.get();
      navigate(st.onboarding.completed ? '#/lessons' : '#/onboarding');
    } catch (err) {
      loginBtn.disabled = false; loginBtn.textContent = 'Zaloguj się';
      toast(err.message || 'Nie udało się zalogować', 'error');
    }
  }
}
