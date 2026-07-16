import { el, navigate } from '../ui.js';

// Strona główna (to, co widać po wejściu na pogadaj.se). Kosmiczny motyw:
// dryfujące gwiazdy/planety leżą globalnie w tle (.cosmos w index.html), tu
// dokładamy hasło, zdjęcie Izabeli po prawej, przyciski logowania i stopkę.
export function renderLanding(mount) {
  const wrap = el('div.landing.fade-in', {}, [
    // Górny pasek: logo z lewej, przyciski konta z prawej (kosmiczne, jak w apce)
    el('header.landing__top', {}, [
      el('div.landing__logo', { html: 'pogadaj<span class="dot">.</span><span class="se">se</span>' }),
      el('div.landing__auth', {}, [
        el('button.btn.btn--cosmic.landing__btn', { onclick: () => navigate('#/login') }, ['Zaloguj się']),
        el('button.btn.btn--primary.landing__btn', { style: 'color:#fff', onclick: () => navigate('#/register') }, ['Stwórz konto']),
      ]),
    ]),

    // Zdjęcie Izabeli po prawej — lewa krawędź wtapia się w kosmos (maska w CSS)
    el('img.landing__hero', { src: 'assets/izabela/hero-landing.jpg', alt: 'Izabela wita Cię na pokładzie' }),

    // Treść po lewej: hasło + wezwanie do działania
    el('div.landing__brand', {}, [
      el('h1.landing__headline', {}, [
        'Wbijaj na statek ',
        el('span.landing__name', { text: 'Izabeli' }),
        ' i gadaj po angielsku już dzisiaj!',
      ]),
      el('button.btn.btn--primary.btn--lg.landing__cta', { style: 'color:#fff', onclick: () => navigate('#/register') }, ['Wejdź na Statek']),
      el('p.landing__trust', { text: 'Masz 15 godzin na przetestowanie apki i ćwiczenie rozmów po angielsku.' }),
      el('p.landing__trust.landing__ps', { html: 'Nie zapomnij zostawić opinii. <b>Senkju my friend</b>' }),
    ]),

    // Dryfujący napis IzabelaCode (subtelnie, w górnej części)
    el('span.landing__mark.landing__mark--1', { text: 'IzabelaCode' }),

    // Stopka
    el('div.landing__footer', { html: 'POWERED BY <b>IZABELACODE</b>' }),
  ]);
  mount.append(wrap);
}
