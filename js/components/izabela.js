import { el } from '../ui.js';

// =============================================================
//  Awatar Izabeli — komponent wielokrotnego użytku
// -------------------------------------------------------------
//  Jeden punkt prawdy dla "twarzy marki". Reaguje miną (mood) i
//  pulsuje przy mówieniu. Kolejne miny/stroje dorzucamy do FACES
//  (np. wygenerowane w Veo: avatar-happy.png, izabela-casual.png...).
// =============================================================

export const FACES = {
  neutral: 'assets/izabela/avatar-neutral.png',
  happy:   'assets/izabela/avatar-neutral.png',  // docelowo osobny kadr z uśmiechem
  oops:    'assets/izabela/avatar-oops.png',
  hero:    'assets/izabela/izabela-hero.png',
};

const RING = {
  neutral: 'var(--accent)',
  happy:   'var(--cyan)',
  oops:    'var(--warn)',
  hero:    'var(--accent)',
};

// izabela({ mood, size, speaking }) -> element <div.iza-av>
export function izabela({ mood = 'neutral', size = 64, speaking = false } = {}) {
  const src = FACES[mood] || FACES.neutral;
  const node = el('div.iza-av', {
    style: `--ring:${RING[mood] || RING.neutral};width:${size}px;height:${size}px`,
    'data-mood': mood,
  }, [
    el('img', { src, alt: 'Izabela', draggable: 'false',
      onerror: function(){ this.replaceWith(el('span', { text: '👩‍🚀', style: 'font-size:' + (size * 0.5) + 'px' })); } }),
  ]);
  if (speaking) node.classList.add('speaking');
  return node;
}

// Zmiana miny istniejącego awatara w miejscu (np. reakcja na błąd)
export function setMood(node, mood) {
  if (!node) return;
  const img = node.querySelector('img');
  if (img) img.src = FACES[mood] || FACES.neutral;
  node.dataset.mood = mood;
  node.style.setProperty('--ring', RING[mood] || RING.neutral);
}

export function setSpeaking(node, on) {
  node?.classList.toggle('speaking', !!on);
}
