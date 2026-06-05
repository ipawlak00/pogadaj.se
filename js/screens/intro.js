import { el, navigate } from '../ui.js';
import { speech } from '../services/speech.js';

// Grafika „Izabela w drzwiach" — wgraj ją tutaj, a pojawi się automatycznie.
// Zanim ją dodasz, używamy pozy stojącej jako podglądu.
const DOOR_IMG = 'assets/izabela/izabela-door.png';
const DOOR_FALLBACK = 'assets/scenes/scene-11.jpg';

// Wejście na pokład: pełnoekranowa Izabela.
//   1) „Leć ze mną" → film na cały ekran
//   2) po filmie: Izabela w drzwiach, mówi „Dobra, to co — lecimy?" → test fonetyczny
export function renderIntro(mount) {
  launch();

  function heroImg() {
    return el('img.hero__img', { src: DOOR_IMG, alt: 'Izabela',
      onerror: function () { this.onerror = null; this.src = DOOR_FALLBACK; } });
  }

  // 1) Wejście — przycisk uruchamia film
  function launch() {
    mount.replaceChildren(
      el('div.hero.fade-in', {}, [
        heroImg(),
        el('button.btn.btn--iza.btn--lg.hero__cta', { onclick: playVideo }, ['Leć ze mną']),
      ])
    );
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

  // 3) Izabela w drzwiach — mówi i zaprasza do testu
  function doorway() {
    speech.stopSpeaking();
    const line = 'Dobra, to co — lecimy? Nie mamy przecież czasu do stracenia.';
    mount.replaceChildren(
      el('div.hero.fade-in', {}, [
        heroImg(),
        el('div.hero__bubble', { text: line }),
        el('button.btn.btn--iza.btn--lg.hero__cta', { onclick: goTest }, ['Lecimy']),
      ])
    );
    speech.speak(line, { lang: 'pl-PL' });
  }

  function goTest() { speech.stopSpeaking(); navigate('#/phonetic'); }
}
