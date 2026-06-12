import { createRoot, type Root } from 'react-dom/client';
import App from './App';
import { getDefaultSettings, normalizeEnvironment, type ChatSettings } from './env';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

function readScriptOptions(): Partial<ChatSettings> {
  const script = document.currentScript as HTMLScriptElement | null;
  return {
    token: script?.dataset.token,
    environment: normalizeEnvironment(script?.dataset.environment),
    surfaceClient: script?.dataset.surfaceClient,
  };
}

function init(options: Partial<ChatSettings> = {}) {
  const initialSettings = getDefaultSettings({
    ...readScriptOptions(),
    ...window.KailyChatConfig,
    ...options,
  });

  if (!host) {
    host = document.createElement('div');
    host.id = 'kaily-chat-widget-root';
    document.body.appendChild(host);
  }

  if (!root) root = createRoot(host);
  root.render(<App embedded initialSettings={initialSettings} />);
}

function destroy() {
  root?.unmount();
  root = undefined;
  host?.remove();
  host = undefined;
}

window.KailyChatWidget = { init, destroy };

if (window.KailyChatConfig || (document.currentScript as HTMLScriptElement | null)?.dataset.autoInit === 'true') {
  init();
}
