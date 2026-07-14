import { el, toast, navigate } from '../ui.js';
import { auth, passwordProblem } from '../services/auth.js';

// Ekran ustawienia NOWEGO hasła po kliknięciu linku z maila.
// Link ma postać: #/reset?e=<email>&t=<token>
export function renderReset(mount) {
  const q = new URLSearchParams((location.hash.split('?')[1] || ''));
  const email = (q.get('e') || '').trim().toLowerCase();
  const token = q.get('t') || '';

  const pass = el('input', { type: 'password', placeholder: 'Nowe hasło', autocomplete: 'new-password' });
  const pass2 = el('input', { type: 'password', placeholder: 'Powtórz nowe hasło', autocomplete: 'new-password' });
  const btn = el('button.btn.btn--primary.btn--lg.btn--block', { style: 'color:#fff', onclick: submit }, ['Ustaw nowe hasło']);
  [pass, pass2].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));

  const badLink = !email || !token;

  mount.append(
    el('div.auth-wrap.fade-in', {}, [
      el('h1.auth-title', {}, ['POGADAJ', el('span.planet-dot'), 'SE']),
      el('div.auth-sub', { text: 'USTAW NOWE HASŁO' }),
      el('div.auth-card', {}, badLink ? [
        el('p', { style: 'color:#46688c;margin:0 0 14px', text: 'Ten link jest niekompletny lub wygasł. Poproś o nowy z ekranu logowania.' }),
        el('button.btn.btn--primary.btn--lg.btn--block', { style: 'color:#fff', onclick: () => { location.hash = '#/'; } }, ['Wróć do logowania']),
      ] : [
        el('p', { style: 'color:#46688c;margin:0 0 12px', html: `Konto: <b>${email}</b>` }),
        el('div.field', {}, [ el('label', { text: 'Nowe hasło' }), pass ]),
        el('div.field', {}, [ el('label', { text: 'Powtórz hasło' }), pass2 ]),
        el('p', { style: 'margin:-6px 0 12px;color:#8aa0c8;font-size:.78rem', text: 'Hasło: minimum 8 znaków, wielka litera i znak specjalny.' }),
        btn,
      ]),
      el('div.auth-footer', { html: 'POWERED BY <b>IZABELACODE</b>' }),
    ])
  );

  setTimeout(() => pass.focus(), 50);

  async function submit() {
    const pp = passwordProblem(pass.value);
    if (pp) { toast(pp, 'error'); return; }
    if (pass.value !== pass2.value) { toast('Hasła nie są takie same', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Zapisuję…';
    try {
      await auth.confirmReset(email, token, pass.value);
      toast('Hasło zmienione! Zaloguj się nowym hasłem.');
      location.hash = '#/';
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Ustaw nowe hasło';
      toast(String((err && err.message) || 'Nie udało się zmienić hasła.'), 'error');
    }
  }
}
