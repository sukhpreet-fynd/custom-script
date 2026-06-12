# Kaily Chat Bot UI

A Vite React chatbot UI powered by `@kaily-ai/chat-sdk`.

## Setup

```bash
npm install
cp .env.example .env.local
```

Set `VITE_KAILY_APP_TOKEN` in `.env.local`, or leave it blank and paste the token in the UI.

## Run locally

```bash
npm run dev
```

## Build

```bash
npm run build
```

The static app is output to `dist/`.

## Deploy as a Kaily CDN widget

The SDK deploy helper bundles `src/widget.tsx` and uploads it to Kaily's PixelBin CDN. It supports plain CSS imports only, so this project does not use Tailwind, PostCSS, Sass, or Less.

```bash
KAILY_APP_TOKEN=your_kaily_copilot_app_token npm run deploy:kaily
```

The command prints a CDN script URL. Embed it on a page:

```html
<script src="https://cdn.pixelbin.io/.../index.js"></script>
<script>
  window.KailyChatWidget.init({
    token: 'your_kaily_copilot_app_token',
    environment: 'production',
    surfaceClient: 'your-site'
  });
</script>
```
