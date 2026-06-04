import { el, navigate } from '../ui.js';
import { speech } from '../services/speech.js';

// Dłuższe powitanie Izabeli (Twój zwrot)
const GREETING = 'O hej, już tu jesteś? Sorki za to lekkie nieogarnięcie, dopiero doleciałam. No dobra — ogarniam włosy, łapię hełm i działamy. Możemy już zaczynać?';

export function renderIntro(mount) {
  const goNext = () => { speech.stopSpeaking(); navigate('#/phonetic'); };

  const portrait = el('div.greet-portrait', { id: 'greet-portrait' }, [
    el('img', { src: 'assets/izabela/izabela-hero.png', alt: 'Izabela',
      onerror: function(){ this.replaceWith(el('span',{text:'👩‍🚀',style:'font-size:5rem'})); } }),
  ]);

  const bubble = el('div.intro-bubble.pop', { style: 'margin-top:0' }, [GREETING]);

  mount.append(
    el('div.greet-wrap.fade-in', {}, [
      el('button.btn.btn--ghost.intro-skip', { onclick: goNext }, ['Pomiń ⏭']),
      portrait,
      bubble,
      el('div.row', { style: 'gap:10px;margin-top:18px;flex-wrap:wrap;justify-content:center' }, [
        el('button.btn.btn--ghost', { onclick: speak }, ['🔊 Powtórz']),
        el('button.btn.btn--primary.btn--lg', { onclick: goNext }, ['Możemy zaczynać! →']),
      ]),
    ])
  );

  speak();

  function speak() {
    portrait.classList.add('speaking');
    speech.speak(GREETING, { lang: 'pl-PL', pitch: 1.1, onEnd: () => portrait.classList.remove('speaking') });
  }
}
