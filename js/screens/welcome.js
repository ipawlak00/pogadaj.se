import { el, toast, navigate, aiConnectButton } from '../ui.js';
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
      el('div.auth-sub', { text: 'GADAJ I UCZ SIĘ Z NAMI!' }),

      el('div.auth-card', {}, [
        el('div.field', {}, [ el('label', { text: 'Email' }), email ]),
        el('div.field', {}, [ el('label', { text: 'Hasło' }), pass ]),
        el('button.btn.btn--primary.auth-submit', { onclick: enterAsGuest }, ['Zaloguj się', el('span.arrow', { text: '→' })]),

        el('div.auth-divider', { text: 'lub kontynuuj przez' }),
        el('div.auth-oauth', {}, [
          el('button.btn.oauth-btn', { onclick: enterAsGuest }, ['🔵 Google']),
          el('button.btn.oauth-btn', { onclick: enterAsGuest }, ['🍎 Apple']),
        ]),

        el('button.btn.auth-create', { onclick: enterAsGuest }, ['Stwórz darmowe konto  👤+']),
      ]),

      el('div.auth-footer', { html: 'POWERED BY <b>IZABELACODE</b>' }),
      el('div.row', { style: 'gap:10px;flex-wrap:wrap;justify-content:center;margin-top:6px' }, [
        aiConnectButton(),
        el('button.btn.btn--ghost', { style: 'font-size:.75rem;padding:6px 14px;opacity:.7',
          onclick: () => { store.reset(); location.hash = '#/'; location.reload(); }
        }, ['↺ Zacznij od nowa (reset)']),
      ]),
    ]),
    el('div.iza-badge', { title: 'Izabela' }, [
      el('img', { src: 'assets/izabela/avatar.png', alt: 'Izabela', onerror: function(){ this.replaceWith(el('span',{text:'👩‍🚀',style:'font-size:1.5rem'})); } }),
      el('span.dot'),
    ])
  );

  async function enterAsGuest() {
    try {
      await auth.signInWithGoogle();   // tryb local → tworzy konto-gościa
      toast('Wchodzisz w trybie podglądu — baw się dobrze! 🚀');
      // Jeśli onboarding już był zrobiony, leć prosto do intro/lekcji; inaczej onboarding.
      navigate(store.get().onboarding.completed ? '#/intro' : '#/onboarding');
    } catch (e) {
      toast(e.message || 'Coś poszło nie tak', 'error');
    }
  }
}
