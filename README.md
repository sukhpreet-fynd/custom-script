# Kaily Chat Widget

A compact mobile-style chat widget powered by `@kaily-ai/chat-sdk`.

## Setup

```bash
npm install
```

The widget auto-connects with the configured Kaily agent token and uses `surfaceClient: "web"`. There is no runtime token or surface-client form in the UI.

## Run locally

```bash
npm run dev
```

## Build

```bash
npm run build
```

The static app is output to `dist/`.

## GitHub Pages

This repo is configured to build with the `/custom-script/` base path for GitHub Pages:

```bash
npm run build
```

Publish the generated `dist/` folder to the `gh-pages` branch. The expected project URL is:

```text
https://sukhpreet-fynd.github.io/custom-script/
```

## Deploy as a Kaily CDN widget

The SDK deploy helper in `@kaily-ai/chat-sdk@2.1.6-beta.6` bundles `src/widget.tsx` and deploys it with a Boltic Personal Access Token. It supports plain CSS imports only, so this project does not use Tailwind, PostCSS, Sass, or Less.

```bash
BOLTIC_PAT=your_boltic_personal_access_token KAILY_APP_TOKEN=your_kaily_copilot_app_token KAILY_DEPLOY_ENVIRONMENT=uat npm run deploy:kaily
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
