# pogadaj.se 🚀

> Nie ucz się angielskiego. **Pogadaj.**

Osobisty nauczyciel AI do **mówienia** po angielsku. Zamiast klikać — rozmawiasz
z **Izabelą**, która słucha, poprawia błędy w czasie rzeczywistym i tłumaczy je
„po polsku", dopasowując się do polskiego toku myślenia.

## ✨ Funkcje (MVP)

- **Mikro-onboarding** — cel + poziom (CEFR) + logowanie.
- **Paszport Fonetyczny** — 20 testowych słówek dobranych pod typowe problemy
  Polaków (TH, R, W/V, ɪ/iː, æ, schwa…). AI buduje profil wymowy ucznia.
- **Rozmowa z Izabelą** — głos (Web Speech API) lub tekst, korekta na bieżąco.
- **Panel Analityka** — błędy z tłumaczeniem lądują z boku, do powtórki.
- **3 darmowe lekcje** (haczyk): rozbicie lodów → aktywna korekta (+ Głosowe
  Koło Ratunkowe w zadaniu) → raport-cliffhanger.
- **PWA** — instalowalna, działa offline (shell).

## 🧱 Stack

- **Frontend:** Vanilla HTML/CSS/JS (PWA), zero buildu. Docelowo React/Tailwind/Shadcn.
- **AI:** Gemini API (logika rozmowy, korekty, podpowiedzi).
- **Audio:** Web Speech API (STT + TTS); docelowo opcja Whisper.
- **Backend:** Firebase (Hosting, Auth, Firestore).

## 🔌 Tryby działania (ważne!)

Aplikacja ma **abstrakcję providera** — działa od razu, bez kluczy, a realne
usługi podpina się **jedną zmianą w `js/config.js`**:

| Obszar | Domyślnie | Docelowo |
|--------|-----------|----------|
| `AI_PROVIDER`   | `stub` (logika lokalna) | `gemini` |
| `AUTH_PROVIDER` | `local` (gość)          | `firebase` |
| `DB_PROVIDER`   | `local` (localStorage)  | `firebase` |

> 🔐 **Klucze API NIGDY nie trafiają do repo.** Klucz Gemini trzymamy po stronie
> Firebase Functions (proxy) i ustawiamy `CONFIG.GEMINI.proxyUrl`.

## ▶️ Uruchomienie lokalne

Wymaga serwowania przez HTTP (moduły ES + mikrofon wymagają `https`/`localhost`):

```bash
# dowolny statyczny serwer, np.:
python3 -m http.server 8080
# → http://localhost:8080
```

## 🚀 Deploy (Firebase Hosting)

```bash
npm i -g firebase-tools
firebase login
firebase use --add        # wybierz projekt
firebase deploy
```

## 📁 Struktura

```
index.html              # shell PWA
css/                    # theme.css (tokeny kosmiczne) + app.css
js/
  app.js                # router (hash) + guardy przepływu
  config.js             # przełączniki providerów + reguły biznesowe
  state.js              # stan + trwałość (localStorage → Firestore)
  ui.js                 # helpery DOM
  services/             # ai.js, speech.js, auth.js (abstrakcje)
  screens/              # welcome, onboarding, phonetic, lessons, conversation
  data/                 # phonetic-words, lessons, izabela (persona/prompt)
assets/izabela/         # awatar (placeholder SVG → docelowo render z animacji)
```

## 🗺️ Roadmapa

- [ ] Podpięcie Gemini (proxy przez Firebase Functions)
- [ ] Firebase Auth (Google) + Firestore (profil, postępy, Analityk)
- [ ] Lepsza analiza wymowy (Whisper / scoring fonemów)
- [ ] Landing Page z subskrypcją (~80 PLN)
- [ ] Migracja na React/Tailwind/Shadcn
