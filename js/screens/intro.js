import { el, navigate } from '../ui.js';
import { speech } from '../services/speech.js';

// Po filmie: Izabela patrzy prosto w kamerę (na użytkownika) i zaprasza dalej.
const HERO_IMG = 'assets/scenes/scene-05.jpg';
const HERO_FALLBACK = 'assets/izabela/izabela-door.png';

// Wejście na pokład:
//   1) NAJPIERW film na cały ekran — bez kontrolek, startuje sam; w rogu tylko „Pomiń"
//   2) PO filmie: Izabela mówi „No to co, lecimy?" + przycisk → test
export function renderIntro(mount) {
  playVideo();

  // 1) Film na cały ekran (bez paska odtwarzania i bez przycisku Odtwórz)
  function playVideo() {
    const video = el('video', { src: 'assets/izabela/intro.mp4',
      playsinline: 'true', preload: 'auto' });
    video.addEventListener('ended', doorway);

    mount.replaceChildren(
      el('div.intro-full', {}, [
        el('button.btn.btn--ghost.intro-skip', { onclick: () => { video.pause(); doorway(); } }, ['Pomiń']),
        video,
      ])
    );
    // Startujemy od razu; gdyby przeglądarka zablokowała dźwięk — dotknięcie ekranu wznawia
    video.play().catch(() => {});
    video.onclick = () => { if (video.paused) video.play().catch(() => {}); };
  }

  // 2) Izabela (patrzy na użytkownika) zaprasza do testu
  function doorway() {
    speech.stopSpeaking();
    const line = 'No to co, lecimy? Nie mamy przecież czasu do stracenia.';
    const img = el('img.hero__img', { src: HERO_IMG, alt: 'Izabela',
      onerror: function () { this.onerror = null; this.src = HERO_FALLBACK; } });
    mount.replaceChildren(
      el('div.hero.fade-in', {}, [
        el('div.hero__frame', {}, [
          img,
          el('div.hero__bubble', { text: line }),
          el('button.btn.btn--iza.btn--lg.hero__cta', { onclick: goTest }, ['Lecimy']),
        ]),
      ])
    );
    speech.speak(line, { lang: 'pl-PL' });
  }

  function goTest() { speech.stopSpeaking(); navigate('#/phonetic'); }
}
