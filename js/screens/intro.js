import { el, navigate } from '../ui.js';
import { speech } from '../services/speech.js';

// Wejście na pokład:
//   1) karta powitalna z przyciskiem „Leć ze mną" (błękit, jak golf Izabeli)
//   2) filmik na cały ekran
//   3) po filmie przycisk „Zaczynajmy"
//   4) okno-wyjaśnienie (tło statku) → Paszport Fonetyczny
export function renderIntro(mount) {
  const goPhonetic = () => { speech.stopSpeaking(); navigate('#/phonetic'); };

  hello();

  // --- 1) Powitanie na pokładzie ---
  function hello() {
    mount.replaceChildren(
      el('div.intro-hello.fade-in', {}, [
        el('div.iza-shot', {}, [
          el('img', { src: 'assets/izabela/izabela-lesson.png', alt: 'Izabela',
            onerror: function () { this.replaceWith(el('div', { style: 'font-size:4rem', text: '👩‍🚀' })); } }),
        ]),
        el('h1.display', { style: 'margin:0', text: 'Witaj na pokładzie! 🚀' }),
        el('p.muted', { style: 'margin:0', text: 'Jestem Izabela — Twoja kapitanka angielskiego. Zaraz ruszamy w naszą podróż.' }),
        el('button.btn.btn--iza.btn--lg', { onclick: playVideo }, ['Leć ze mną 🚀']),
      ])
    );
  }

  // --- 2) Filmik na cały ekran + 3) przycisk „Zaczynajmy" ---
  function playVideo() {
    const video = el('video', { src: 'assets/izabela/intro.mp4', playsinline: 'true',
      controls: 'true', autoplay: 'true', preload: 'auto' });

    const goBtn = el('div.intro-go', {}, [
      el('button.btn.btn--iza.btn--lg', { onclick: explain }, ['Zaczynajmy']),
    ]);
    const reveal = () => goBtn.classList.add('show');
    video.addEventListener('ended', reveal);

    mount.replaceChildren(
      el('div.intro-full', {}, [
        el('button.btn.btn--ghost.intro-skip', { onclick: () => { video.pause(); explain(); } }, ['Pomiń ⏭']),
        video,
        goBtn,
      ])
    );
    video.play().catch(() => reveal());   // gdy autoplay zablokowany → od razu pokaż „Zaczynajmy"
  }

  // --- 4) Okno-wyjaśnienie przed paszportem ---
  function explain() {
    speech.stopSpeaking();
    const line = 'Teraz poproszę Cię o powtórzenie kilku słów, żebym poznała Twój głos i akcent!';
    mount.replaceChildren(
      el('div.intro-hello.fade-in', {}, [
        el('div', { style: 'font-size:3.2rem', text: '🎤' }),
        el('h1.display', { style: 'margin:0', text: 'Poznajmy Twój głos' }),
        el('p', { style: 'margin:0;font-size:1.1rem;line-height:1.5', text: line }),
        el('p.muted', { style: 'margin:0', text: 'Posłuchasz słowa, a potem powtórzysz je do mikrofonu. Bez stresu — to tylko kalibracja.' }),
        el('button.btn.btn--iza.btn--lg', { onclick: goPhonetic }, ['Jestem gotowy/gotowa →']),
      ])
    );
    speech.speak(line, { lang: 'pl-PL' });
  }
}
