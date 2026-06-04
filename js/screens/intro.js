import { el, navigate } from '../ui.js';
import { speech } from '../services/speech.js';

// Intro = Twój filmik (animacja Izabeli w stacji). Po nim → Paszport Fonetyczny.
export function renderIntro(mount) {
  const goNext = () => { speech.stopSpeaking(); navigate('#/phonetic'); };

  const startBtn = el('button.btn.btn--primary.btn--lg', { onclick: goNext }, ['Możemy zaczynać! →']);

  const video = el('video', {
    src: 'assets/izabela/intro.mp4',
    playsinline: 'true', controls: 'true', preload: 'auto',
  });
  video.addEventListener('ended', () => startBtn.classList.add('pulse'));

  const playOverlay = el('button.btn.btn--primary.btn--lg', {
    style: 'position:absolute;inset:0;margin:auto;width:max-content;height:max-content;z-index:4',
    onclick: () => { playOverlay.classList.add('hidden'); video.play().catch(() => {}); },
  }, ['▶ Odtwórz powitanie']);

  mount.append(
    el('div.intro-video-wrap.fade-in', { style: 'position:relative' }, [
      el('button.btn.btn--ghost.intro-skip', { onclick: () => { video.pause(); goNext(); } }, ['Pomiń ⏭']),
      el('div.intro-video', { style: 'position:relative' }, [video, playOverlay]),
      el('p.muted', { style: 'text-align:center;margin:0', text: 'Witaj na pokładzie! 🚀' }),
      startBtn,
    ])
  );

  video.play().then(() => playOverlay.classList.add('hidden')).catch(() => {});
}
