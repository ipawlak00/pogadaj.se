import { el, navigate, toast } from '../ui.js';
import { speech } from '../services/speech.js';
import { IZABELA } from '../data/izabela.js';

// Kwestia powitalna Izabeli (zgodnie z pomysłem na animację)
const GREETING_LINE = 'O hej, już tu jesteś? Sorki za to lekkie nieogarnięcie, dopiero doleciałam. Możemy już zaczynać?';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function renderIntro(mount) {
  let cancelled = false;
  const after = () => { if (!cancelled) navigate('#/phonetic'); };

  const caption = el('div.intro-caption', { id: 'intro-cap' });
  const bubble = el('div.intro-bubble.hidden', { id: 'intro-bubble' });
  const startBtn = el('button.btn.btn--primary.btn--lg.hidden', { id: 'intro-start', onclick: () => { cancelled = true; after(); } }, ['Możemy zaczynać! →']);
  const skip = el('button.btn.btn--ghost.intro-skip', { onclick: () => { cancelled = true; speech.stopSpeaking(); after(); } }, ['Pomiń ⏭']);

  const stage = el('div.intro-stage', { id: 'intro-stage' }, [
    // Stacja / platforma
    el('div.intro-platform'),
    el('div.intro-ramp'),
    // Rakieta
    rocketSVG(),
    // Dym z lądowania
    el('div.intro-smoke', { id: 'intro-smoke' }, [el('i'), el('i'), el('i'), el('i')]),
    // Aktor — Izabela
    el('div.iza-actor', { id: 'iza-actor', html: izabelaFigureSVG() }),
  ]);

  mount.append(
    el('div.intro-wrap.fade-in', {}, [ skip, stage, caption, bubble, el('div.intro-cta', {}, [startBtn]) ])
  );

  play();

  async function play() {
    const cap = (t) => { if (!cancelled) caption.textContent = t; };
    const actor = () => document.getElementById('iza-actor');

    await sleep(300);
    cap('Gdzieś na orbicie nad stacją...');
    document.getElementById('intro-smoke')?.classList.add('on');
    await sleep(1600); if (cancelled) return;

    cap('Izabela ląduje...');
    actor()?.classList.add('walk');
    await sleep(2400); if (cancelled) return;

    // Potknięcie
    cap('Ups! 😬');
    actor()?.classList.remove('walk');
    actor()?.classList.add('trip');
    await sleep(700); if (cancelled) return;

    actor()?.classList.remove('trip');
    actor()?.classList.add('fallen');
    await sleep(1100); if (cancelled) return;

    // Wstaje, obolała
    cap('Auć... no dobra, wstaję.');
    actor()?.classList.remove('fallen');
    actor()?.classList.add('standup', 'dazed');
    await sleep(1200); if (cancelled) return;

    // Ociera włosy
    cap('*ociera włosy, poprawia hełm pod pachą*');
    actor()?.classList.add('dust');
    await sleep(1400); if (cancelled) return;
    actor()?.classList.remove('dust');

    // Odwraca się do ekranu
    actor()?.classList.add('facing');
    actor()?.classList.remove('dazed');
    await sleep(700); if (cancelled) return;

    // Mówi
    showBubble(GREETING_LINE);
    actor()?.classList.add('speaking');
    speech.speak(GREETING_LINE, { lang: 'pl-PL', pitch: 1.1, onEnd: () => actor()?.classList.remove('speaking') });
    cap('');
    await sleep(400); if (cancelled) return;

    document.getElementById('intro-start')?.classList.remove('hidden');
  }

  function showBubble(text) {
    const b = document.getElementById('intro-bubble');
    if (!b) return;
    b.textContent = text;
    b.classList.remove('hidden');
    b.classList.add('pop');
  }
}

// ---- Rakieta (SVG) ----
function rocketSVG() {
  return el('div.intro-rocket', { html: `
    <svg viewBox="0 0 160 320" width="160" height="320" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rk" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#cfd6ef"/><stop offset="50%" stop-color="#9aa4cc"/><stop offset="100%" stop-color="#6c769e"/>
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="300" rx="70" ry="14" fill="rgba(0,0,0,.35)"/>
      <path d="M80 10 C120 60 120 180 110 250 L50 250 C40 180 40 60 80 10Z" fill="url(#rk)" stroke="#3a4170" stroke-width="2"/>
      <circle cx="80" cy="90" r="16" fill="#5b8cff" stroke="#fff" stroke-width="3"/>
      <circle cx="80" cy="150" r="11" fill="#46e0d8" stroke="#fff" stroke-width="2"/>
      <path d="M50 250 L20 300 L55 280 Z" fill="#6c769e" stroke="#3a4170" stroke-width="2"/>
      <path d="M110 250 L140 300 L105 280 Z" fill="#6c769e" stroke="#3a4170" stroke-width="2"/>
      <rect x="66" y="250" width="28" height="22" rx="4" fill="#ff7eb6"/>
    </svg>` });
}

// ---- Pełna postać Izabeli (SVG, animowalne części) ----
function izabelaFigureSVG() {
  return `
  <svg viewBox="0 0 140 220" width="140" height="220" xmlns="http://www.w3.org/2000/svg" class="iza-svg">
    <defs>
      <linearGradient id="suit" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#dfe3f2"/>
      </linearGradient>
      <linearGradient id="hairg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7a4e2c"/><stop offset="100%" stop-color="#4a2d18"/>
      </linearGradient>
    </defs>

    <!-- nogi -->
    <rect x="54" y="150" width="14" height="52" rx="7" fill="url(#suit)" stroke="#c2c8de" stroke-width="1.5"/>
    <rect x="72" y="150" width="14" height="52" rx="7" fill="url(#suit)" stroke="#c2c8de" stroke-width="1.5"/>
    <ellipse cx="61" cy="206" rx="11" ry="6" fill="#9aa4cc"/>
    <ellipse cx="79" cy="206" rx="11" ry="6" fill="#9aa4cc"/>

    <!-- hełm pod lewą pachą -->
    <g id="iza-helmet">
      <circle cx="30" cy="120" r="20" fill="#eef1fb" stroke="#bcc3df" stroke-width="2"/>
      <path d="M16 116 A16 16 0 0 1 44 116 Z" fill="#5b8cff" opacity=".55"/>
    </g>

    <!-- lewe ramię (trzyma hełm) -->
    <rect id="iza-arm-l" x="34" y="96" width="13" height="40" rx="6.5" fill="url(#suit)" stroke="#c2c8de" stroke-width="1.5" transform="rotate(18 40 100)"/>

    <!-- tułów / skafander -->
    <path d="M48 96 Q70 86 92 96 L96 156 Q70 166 44 156 Z" fill="url(#suit)" stroke="#c2c8de" stroke-width="2"/>
    <!-- panel na piersi -->
    <rect x="60" y="112" width="20" height="16" rx="3" fill="#cdd3e8"/>
    <rect x="63" y="115" width="5" height="5" fill="#ff6b81"/>
    <rect x="72" y="115" width="5" height="5" fill="#46e0d8"/>
    <!-- naszywki-flagi na ramionach -->
    <rect x="48" y="98" width="9" height="6" fill="#ff6b81"/>
    <rect x="83" y="98" width="9" height="6" fill="#46e0d8"/>

    <!-- prawe ramię (macha / ociera włosy) -->
    <g id="iza-arm-r" style="transform-origin:92px 100px">
      <rect x="88" y="96" width="13" height="40" rx="6.5" fill="url(#suit)" stroke="#c2c8de" stroke-width="1.5"/>
      <circle cx="94" cy="138" r="7" fill="#f0c9a8"/>
    </g>

    <!-- głowa -->
    <g id="iza-head" style="transform-origin:70px 60px">
      <!-- włosy tył -->
      <path d="M44 58 Q42 26 70 24 Q98 26 96 58 L98 96 Q70 88 42 96 Z" fill="url(#hairg)"/>
      <!-- twarz -->
      <ellipse cx="70" cy="58" rx="26" ry="29" fill="#f0c9a8"/>
      <!-- grzywka -->
      <path d="M46 48 Q56 28 70 27 Q84 28 94 48 Q80 40 70 42 Q60 40 46 48Z" fill="url(#hairg)"/>
      <!-- okulary -->
      <circle cx="59" cy="58" r="9.5" fill="#fff" fill-opacity=".25" stroke="#caa26f" stroke-width="2.2"/>
      <circle cx="81" cy="58" r="9.5" fill="#fff" fill-opacity=".25" stroke="#caa26f" stroke-width="2.2"/>
      <line x1="68.5" y1="58" x2="71.5" y2="58" stroke="#caa26f" stroke-width="2.2"/>
      <circle class="iza-eye" cx="59" cy="58" r="2.6" fill="#3a2a1a"/>
      <circle class="iza-eye" cx="81" cy="58" r="2.6" fill="#3a2a1a"/>
      <!-- brwi -->
      <path class="iza-brow" d="M51 47 Q59 44 67 47" stroke="#4a2d18" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path class="iza-brow" d="M73 47 Q81 44 89 47" stroke="#4a2d18" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <!-- usta (zmiana wyrazu przez klasy na aktorze) -->
      <path class="mouth-neutral" d="M62 72 Q70 77 78 72" stroke="#b5654a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path class="mouth-grimace" d="M62 74 Q70 69 78 74" stroke="#b5654a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <ellipse class="mouth-talk" cx="70" cy="73" rx="4" ry="3" fill="#7a3b2e"/>
    </g>
  </svg>`;
}
