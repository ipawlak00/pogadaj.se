import { el, toast, navigate } from '../ui.js';
import { auth, passwordProblem } from '../services/auth.js';

// Ekran logowania / zakładania konta, JEDNA karta, dwa tryby.
// Rejestracja: imię + email + hasło + powtórz hasło. Logowanie: email + hasło.
export function renderWelcome(mount) {
  let mode = 'login';   // 'login' | 'signup'

  const name = el('input', { type: 'text', placeholder: 'Twoje imię', autocomplete: 'given-name', maxlength: '40' });
  const email = el('input', { type: 'email', placeholder: 'twój@email.com', autocomplete: 'email' });
  const pass = el('input', { type: 'password', placeholder: 'Hasło', autocomplete: 'current-password' });
  const pass2 = el('input', { type: 'password', placeholder: 'Powtórz hasło', autocomplete: 'new-password' });
  const passHint = el('p', { style: 'margin:-6px 0 12px;color:#8aa0c8;font-size:.78rem;display:none', text: 'Hasło: minimum 8 znaków, wielka litera i znak specjalny.' });

  const nameField = el('div.field', { style: 'display:none' }, [ el('label', { text: 'Imię' }), name ]);
  const pass2Field = el('div.field', { style: 'display:none' }, [ el('label', { text: 'Powtórz hasło' }), pass2 ]);

  const mainBtn = el('button.btn.btn--primary.auth-submit', { onclick: submit }, ['Zaloguj się']);
  const switchBtn = el('button.btn.auth-create', { style: 'margin-top:14px', onclick: toggleMode }, ['Stwórz darmowe konto']);
  const forgotLink = el('button.auth-forgot', { type: 'button', onclick: forgotPassword }, ['Nie pamiętasz hasła?']);

  [pass, pass2, email, name].forEach((inp) => inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));

  mount.append(
    el('div.auth-wrap.fade-in', {}, [
      el('h1.auth-title', {}, ['POGADAJ', el('span.planet-dot'), 'SE']),
      el('div.auth-sub', { text: 'GADAJ I UCZ SIĘ ANGIELSKIEGO Z IZABELĄ!' }),

      el('div.auth-card', {}, [
        nameField,
        el('div.field', {}, [ el('label', { text: 'Email' }), email ]),
        el('div.field', {}, [ el('label', { text: 'Hasło' }), pass ]),
        pass2Field,
        passHint,
        mainBtn,
        forgotLink,
        switchBtn,
      ]),

      el('div.auth-footer', { html: 'POWERED BY <b>IZABELACODE</b>' }),
    ])
  );

  // Z landingu „Stwórz konto" -> otwórz od razu w trybie rejestracji.
  if ((location.hash || '').includes('register')) toggleMode();

  function toggleMode() {
    mode = mode === 'login' ? 'signup' : 'login';
    const signup = mode === 'signup';
    mainBtn.textContent = signup ? 'Załóż darmowe konto' : 'Zaloguj się';
    switchBtn.textContent = signup ? 'Mam już konto. Zaloguj się' : 'Stwórz darmowe konto';
    nameField.style.display = signup ? 'block' : 'none';
    pass2Field.style.display = signup ? 'block' : 'none';
    passHint.style.display = signup ? 'block' : 'none';
    forgotLink.style.display = signup ? 'none' : 'block';
    pass.autocomplete = signup ? 'new-password' : 'current-password';
    (signup ? name : email).focus();
  }

  // Przypomnienie hasła: e-mail z linkiem resetującym (SMTP izabela@izabelacode.pl).
  function forgotPassword() {
    const inp = el('input', { type: 'email', placeholder: 'twój@email.com', autocomplete: 'email', value: email.value.trim() });
    const sendBtn = el('button.btn.btn--primary.btn--lg.btn--block', { style: 'color:#fff', onclick: send }, ['Wyślij link']);
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') send(); });
    const overlay = el('div.level-overlay', { onclick: (ev) => { if (ev.target === overlay) overlay.remove(); } }, [
      el('div.level-box.feedback-box', {}, [
        el('button.level-close', { onclick: () => overlay.remove(), 'aria-label': 'Zamknij' }, ['X']),
        el('h2.display', { style: 'margin:0 0 4px;color:#14314f', text: 'Przypomnijmy hasło' }),
        el('p', { style: 'margin:0 0 12px;color:#46688c', text: 'Podaj email użyty przy zakładaniu konta, wyślę link do ustawienia nowego hasła.' }),
        el('div.field', {}, [ el('label', { text: 'Email' }), inp ]),
        sendBtn,
      ]),
    ]);
    document.body.append(overlay);
    setTimeout(() => inp.focus(), 50);

    async function send() {
      const e = inp.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast('Podaj poprawny adres email', 'error'); return; }
      sendBtn.disabled = true; sendBtn.textContent = 'Wysyłam…';
      try { await auth.requestReset(e); } catch (err) { /* i tak pokazujemy neutralny komunikat */ }
      overlay.remove();
      toast('Jeśli konto istnieje, link do zmiany hasła jest już w Twojej skrzynce. Sprawdź też spam.');
    }
  }

  async function submit() {
    const e = email.value.trim();
    if (mode === 'signup' && !name.value.trim()) { toast('Podaj swoje imię', 'error'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast('Podaj poprawny adres email', 'error'); return; }
    if (!pass.value) { toast('Podaj hasło', 'error'); return; }
    if (mode === 'signup') {
      const pp = passwordProblem(pass.value);
      if (pp) { toast(pp, 'error'); return; }
      if (pass.value !== pass2.value) { toast('Hasła nie są takie same', 'error'); return; }
    }
    const label = mainBtn.textContent;
    mainBtn.disabled = true; mainBtn.textContent = mode === 'login' ? 'Loguję…' : 'Zakładam konto…';
    try {
      if (mode === 'login') {
        await auth.login({ email: e, password: pass.value });
        navigate('#/');                 // router pokieruje wg etapu
      } else {
        await auth.register({ name: name.value.trim(), email: e, password: pass.value });
        navigate('#/intro');            // FILM zaraz po utworzeniu konta
      }
    } catch (err) {
      console.error('[auth]', err);
      mainBtn.disabled = false; mainBtn.textContent = label;
      toast(friendlyError(err), 'error');
    }
  }
}

// Techniczne błędy zamieniamy na ludzkie komunikaty (spójne z resztą apki).
function friendlyError(err) {
  const m = String((err && err.message) || err || '');
  if (/Failed to fetch|NetworkError|network|load failed/i.test(m)) {
    return 'Brak połączenia z serwerem. Sprawdź internet i spróbuj za chwilę.';
  }
  if (/origin not allowed|forbidden|\b403\b/i.test(m)) {
    return 'Coś blokuje połączenie z serwerem. Spróbuj ponownie za chwilę.';
  }
  // Komunikaty z serwera są już po polsku i przyjazne, pokazujemy je wprost.
  if (m && !/\b\d{3}\b|http|fetch|json|undefined/i.test(m)) return m;
  return 'Ojej, coś nie pykło. Spróbuj jeszcze raz za chwilę.';
}
