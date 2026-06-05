import { el, navigate } from '../ui.js';
import { speech } from '../services/speech.js';

// Grafika Izabeli przy holograficznym stole (ręka + rysik na hologramie).
const HERO_IMG = 'assets/izabela/izabela-door.png';
const HERO_FALLBACK = 'assets/scenes/scene-04.jpg';

// Wejście na pokład:
//   1) NAJPIERW film na cały ekran (autoodtwarzanie; gdy zablokowane → przycisk)
//   2) PO filmie: Izabela mówi „No to co, lecimy?" + przycisk na hologramie → test
export function renderIntro(mount) {
  playVideo();

  // 1) Film na cały ekran
  function playVideo() {
    const video = el('video', { src: 'assets/izabela/intro.mp4',
      playsinline: 'true', controls: 'true', preload: 'auto' });
    video.addEventListener('ended', doorway);

    const playBtn = el('button.btn.btn--iza.btn--lg.intro-play', {
      onclick: () => { playBtn.classList.add('hidden'); video.play().catch(() => {}); },
    }, ['Odtwórz']);

    mount.replaceChildren(
      el('div.intro-full', {}, [
        el('button.btn.btn--ghost.intro-skip', { onclick: () => { video.pause(); doorway(); } }, ['Pomiń']),
        video,
        playBtn,
      ])
    );
    // Spróbuj odtworzyć od razu; gdy przeglądarka zablokuje — pokaż przycisk „Odtwórz"
    video.play().then(() => playBtn.classList.add('hidden')).catch(() => {});
  }

  // 2) Izabela zaprasza do testu — mówi i wskazuje przycisk na hologramie
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
