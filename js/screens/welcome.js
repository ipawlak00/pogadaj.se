import { el, topbar, navigate } from '../ui.js';
import { IZABELA } from '../data/izabela.js';

export function renderWelcome(mount) {
  mount.append(
    topbar(),
    el('div.stack.center.fade-in', { style: 'max-width:620px;margin:6vh auto;gap:24px' }, [
      el('div.izabela', { style: 'margin:0 auto' }, [
        el('img', { src: 'assets/izabela/avatar.svg', alt: 'Izabela', onerror: function(){ this.replaceWith(el('span',{text:'👩‍🚀',style:'font-size:3rem'})); } }),
      ]),
      el('h1.display', { style: 'font-size:clamp(2.2rem,7vw,3.4rem);margin:0', html: 'Nie ucz się angielskiego.<br><span style="color:var(--accent)">Pogadaj.</span>' }),
      el('p.muted', { style: 'font-size:1.15rem;margin:0', text: `Cześć, jestem ${IZABELA.name} — Twoja nauczycielka AI. Przełamiemy razem blokadę w mówieniu. W kosmosie nikt nie usłyszy Twoich błędów. 🚀` }),
      el('div.row.center', { style: 'justify-content:center;gap:12px;flex-wrap:wrap' }, [
        el('button.btn.btn--primary.btn--lg', { onclick: () => navigate('#/onboarding') }, ['Zaczynamy ✨']),
      ]),
      el('p.faint', { style: 'margin-top:8px', text: '3 darmowe lekcje • bez karty • mów, nie klikaj' }),
    ])
  );
}
