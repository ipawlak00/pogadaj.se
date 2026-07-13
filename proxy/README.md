# Proxy — konfiguracja serwera

Program-pośrednik trzyma sekretny klucz po stronie serwera (nigdy w kodzie
przeglądarki). Przeglądarka pyta proxy → proxy dokłada klucz i odpytuje usługę.

## Wariant: Google Cloud Functions

Pliki: [`google/index.js`](./google/index.js), [`google/package.json`](./google/package.json).

Kroki:
1. W [Google Cloud Console](https://console.cloud.google.com) wybierz/utwórz **projekt**
   (najlepiej ten sam, w którym masz włączony billing Gemini).
2. Włącz API: **Generative Language API**, **Cloud Functions API**, **Cloud Run API**,
   **Secret Manager API**.
3. **Secret Manager** → utwórz sekret `GEMINI_KEY` = Twój klucz Gemini.
4. Wgraj funkcję (w katalogu `proxy/google`):
   ```bash
   gcloud functions deploy gemini-proxy \
     --gen2 --runtime=nodejs20 --region=europe-central2 \
     --source=. --entry-point=geminiProxy \
     --trigger-http --allow-unauthenticated \
     --set-secrets=GEMINI_KEY=GEMINI_KEY:latest
   ```
   (Można też przez konsolę: Cloud Functions → Create function → wklej `index.js`
   i `package.json`, dodaj sekret `GEMINI_KEY`.)
5. Skopiuj URL funkcji (np. `https://europe-central2-twoj-projekt.cloudfunctions.net/gemini-proxy`).
6. W `js/config.js` ustaw:
   ```js
   GEMINI: {
     ...
     proxyBase: 'https://europe-central2-twoj-projekt.cloudfunctions.net/gemini-proxy',
   }
   ```
   `apiKey` zostaw puste. Zacommituj i wypchnij.
7. Gotowe — głos Gemini działa u każdego, klucz został w Google.

Hosting strony też możesz przenieść do Google (**Firebase Hosting**), żeby wszystko
było w jednym projekcie. Apka to statyczne pliki — `firebase init hosting` + `firebase deploy`.

## Alternatywa: Cloudflare Worker

Jeśli wolisz postawić proxy poza Google (równie dobre, darmowy plan), użyj
[`cloudflare-worker.js`](./cloudflare-worker.js):
1. dash.cloudflare.com → Workers & Pages → Create Worker → Deploy.
2. Edit code → wklej `cloudflare-worker.js` → Deploy.
3. Settings → Variables → **Secret** `GEMINI_KEY` = Twój klucz.
4. Skopiuj URL Workera → wpisz w `js/config.js` → `proxyBase`.

## Bezpieczeństwo (oba warianty)

- W `ALLOW_ORIGINS` trzymaj tylko swoje domeny (`https://ipawlak00.github.io`, itp.).
- W Google ustaw **budżet i alerty** na projekcie (kontrola kosztów).
- Proxy wpuszcza wyłącznie `…/v1beta/models/<model>:generateContent` — nic więcej.
