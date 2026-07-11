import { el, toast, navigate } from '../ui.js';
import { auth, passwordProblem } from '../services/auth.js';
import { store } from '../state.js';

// Ekran logowania / zakładania konta — JEDNA karta, dwa tryby.
// Zakładanie konta wygląda tak samo jak logowanie (email + hasło),
// tylko tworzy konto i prowadzi prosto do filmu z Izabelą.
export function renderWelcome(mount) {
  let mode = 'login';   // 'login' | 'signup'

  const email = el('input', { type: 'email', placeholder: 'twój@email.com', autocomplete: 'email' });
  const pass = el('input', { type: 'password', placeholder: 'Hasło', autocomplete: 'current-password' });
  const passHint = el('p', { style: 'margin:-8px 0 12px;color:#8aa0c8;font-size:.78rem;display:none', text: 'Hasło: minimum 8 znaków, wielka litera i znak specjalny.' });
  const mainBtn = el('button.btn.btn--primary.auth-submit', { onclick: submit }, ['Zaloguj się']);
  const switchBtn = el('button.btn.auth-create', { style: 'margin-top:14px', onclick: toggleMode }, ['Stwórz darmowe konto']);

  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  mount.append(
    el('div.auth-wrap.fade-in', {}, [
      el('h1.auth-title', {}, ['POGADAJ', el('span.planet-dot'), 'SE']),
      el('div.auth-sub', { text: 'GADAJ I UCZ SIĘ ANGIELSKIEGO Z IZABELĄ!' }),

      el('div.auth-card', {}, [
        el('div.field', {}, [ el('label', { text: 'Email' }), email ]),
        el('div.field', {}, [ el('label', { text: 'Hasło' }), pass ]),
        passHint,
        mainBtn,
        switchBtn,
      ]),

      el('div.auth-footer', { html: 'POWERED BY <b>IZABELACODE</b>' }),
      el('button.auth-reset', {
        onclick: () => { store.reset(); location.hash = '#/'; location.reload(); },
        title: 'Czyści postępy i ustawienia zapisane na tym urządzeniu',
      }, ['Zacznij od nowa']),
    ])
  );

  function toggleMode() {
    mode = mode === 'login' ? 'signup' : 'login';
    mainBtn.textContent = mode === 'login' ? 'Zaloguj się' : 'Załóż darmowe konto';
    switchBtn.textContent = mode === 'login' ? 'Stwórz darmowe konto' : 'Mam już konto. Zaloguj się';
    passHint.style.display = mode === 'signup' ? 'block' : 'none';
    pass.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    email.focus();
  }

  async function submit() {
    const e = email.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast('Podaj poprawny adres email', 'error'); return; }
    if (!pass.value) { toast('Podaj hasło', 'error'); return; }
    if (mode === 'signup') {
      const pp = passwordProblem(pass.value);
      if (pp) { toast(pp, 'error'); return; }
    }
    const label = mainBtn.textContent;
    mainBtn.disabled = true; mainBtn.textContent = mode === 'login' ? 'Loguję…' : 'Zakładam konto…';
    try {
      if (mode === 'login') {
        await auth.login({ email: e, password: pass.value });
        navigate('#/');                 // router pokieruje wg etapu
      } else {
        await auth.register({ email: e, password: pass.value });
        navigate('#/intro');            // FILM zaraz po utworzeniu konta
      }
    } catch (err) {
      mainBtn.disabled = false; mainBtn.textContent = label;
      toast(err.message || 'Coś poszło nie tak', 'error');
    }
  }
}
