# Proxy Gemini — głos i rozmowa dla WSZYSTKICH bez klucza

Cel: każdy użytkownik pogadaj.se dostaje naturalny głos Gemini i rozmowę z Izabelą
**od razu po wejściu**, bez wklejania własnego klucza API. Klucz trzymamy po stronie
serwera (w proxy), a przeglądarka woła proxy bez klucza.

Dlaczego nie wkleić klucza wprost do kodu? Bo repo jest publiczne — GitHub i Google
wykryją klucz i **automatycznie go unieważnią**, a do tego ktoś mógłby wydrenować
Twój budżet. Proxy to rozwiązuje.

## Wdrożenie na Cloudflare Workers (darmowe, ~5 minut)

1. Wejdź na https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker**.
2. Nadaj nazwę, np. `pogadajse-proxy`, kliknij **Deploy** (na razie z domyślnym kodem).
3. Kliknij **Edit code**, usuń wszystko i wklej zawartość pliku
   [`cloudflare-worker.js`](./cloudflare-worker.js). Kliknij **Deploy**.
4. Wejdź w **Settings → Variables and Secrets → Add**:
   - typ: **Secret**
   - nazwa: `GEMINI_KEY`
   - wartość: Twój klucz Gemini (ten z włączonym billingiem).
   - **Deploy/Save**.
5. Skopiuj adres Workera, np. `https://pogadajse-proxy.twoj-login.workers.dev`.
6. W pliku `js/config.js` ustaw:

   ```js
   GEMINI: {
     ...
     proxyBase: 'https://pogadajse-proxy.twoj-login.workers.dev',
   }
   ```

   (Nie ustawiaj `apiKey` w configu — ma zostać puste.)
7. Zacommituj zmianę w `config.js` i wypchnij. Gotowe — głos Gemini działa u każdego.

## Bezpieczeństwo

- W `cloudflare-worker.js` w `ALLOW_ORIGINS` trzymaj tylko swoje domeny
  (`https://ipawlak00.github.io` itd.). To ogranicza, kto może wołać proxy.
- W Google Cloud ustaw **budżet i alerty** na projekcie klucza (np. limit miesięczny),
  żeby mieć pełną kontrolę kosztów.
- Worker wpuszcza wyłącznie `…/v1beta/models/<model>:generateContent` — nic innego.

## Alternatywy

Każda platforma z funkcjami serverless zadziała tak samo (klucz jako zmienna
środowiskowa, ten sam reverse-proxy do `generativelanguage.googleapis.com`):
Vercel, Netlify Functions, Firebase Functions, Deno Deploy. Logika jest identyczna
jak w `cloudflare-worker.js`.
