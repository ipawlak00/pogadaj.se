import { el, navigate } from '../ui.js';
import { speech } from '../services/speech.js';

// Grafika Izabeli przy holograficznym stole (ręka + rysik na hologramie).
const HERO_IMG = 'assets/izabela/izabela-door.png';
const HERO_FALLBACK = 'assets/scenes/scene-04.jpg';

// Wejście na pokład — pełnoekranowa Izabela.
//   1) „Leć ze mną" → film na cały ekran
//   2) po filmie: Izabela mówi „Dobra, to co — lecimy?" + przycisk na hologramie → test
export function renderIntro(mount) {
  launch();

  // Kadr 16:9 z Izabelą; dzieci pozycjonowane w % względem kadru (trzymają się dłoni).
  function heroFrame(children) {
    const img = el('img.hero__img', { src: HERO_IMG, alt: 'Izabela',
      onerror: function () { this.onerror = null; this.src = HERO_FALLBACK; } });
    return el('div.hero.fade-in', {}, [el('div.hero__frame', {}, [img, ...children])]);
  }

  // 1) Wejście — przycisk uruchamia film
  function launch() {
    mount.replaceChildren(heroFrame([
      el('button.btn.btn--iza.btn--lg.hero__cta', { onclick: playVideo }, ['Leć ze mną']),
    ]));
  }

  // 2) Film na cały ekran
  function playVideo() {
    const video = el('video', { src: 'assets/izabela/intro.mp4',
      playsinline: 'true', controls: 'true', autoplay: 'true', preload: 'auto' });
    video.addEventListener('ended', doorway);

    mount.replaceChildren(
      el('div.intro-full', {}, [
        el('button.btn.btn--ghost.intro-skip', { onclick: () => { video.pause(); doorway(); } }, ['Pomiń']),
        video,
      ])
    );
    video.play().catch(doorway);   // gdy autoplay zablokowany → przejdź dalej
  }

  // 3) Izabela zaprasza do testu — mówi i wskazuje przycisk na hologramie
  function doorway() {
    speech.stopSpeaking();
    const line = 'Dobra, to co — lecimy? Nie mamy przecież czasu do stracenia.';
    mount.replaceChildren(heroFrame([
      el('div.hero__bubble', { text: line }),
      el('button.btn.btn--iza.btn--lg.hero__cta', { onclick: goTest }, ['Lecimy']),
    ]));
    speech.speak(line, { lang: 'pl-PL' });
  }

  function goTest() { speech.stopSpeaking(); navigate('#/phonetic'); }
}
