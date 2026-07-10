import { el, navigate } from '../ui.js';
import { speech } from '../services/speech.js';
import { store } from '../state.js';

// Wejście na pokład: film na cały ekran (bez kontrolek, startuje sam),
// a po nim OD RAZU test fonetyczny — tam wita Izabela.
export function renderIntro(mount) {
  const video = el('video', { src: 'assets/izabela/intro.mp4',
    playsinline: 'true', preload: 'auto' });
  video.addEventListener('ended', goTest);

  mount.replaceChildren(
    el('div.intro-full', {}, [
      el('button.btn.btn--ghost.intro-skip', { onclick: () => { video.pause(); goTest(); } }, ['Pomiń']),
      video,
    ])
  );
  // Startujemy od razu; gdyby przeglądarka zablokowała dźwięk — dotknięcie ekranu wznawia
  video.play().catch(() => {});
  video.onclick = () => { if (video.paused) video.play().catch(() => {}); };

  function goTest() {
    speech.stopSpeaking();
    store.patchKey('progress', { introSeen: true });
    const st = store.get();
    navigate(!st.onboarding.completed ? '#/onboarding'
      : (!st.phonetic.completed ? '#/phonetic' : '#/lessons'));
  }
}
