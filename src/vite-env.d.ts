/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KAILY_APP_TOKEN?: string;
  readonly VITE_KAILY_ENVIRONMENT?: 'production' | 'uat' | 'sit';
  readonly VITE_KAILY_SURFACE_CLIENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type KailyWidgetOptions = {
  token?: string;
  environment?: 'production' | 'uat' | 'sit';
  surfaceClient?: string;
};

interface Window {
  KailyChatConfig?: KailyWidgetOptions;
  KailyChatWidget?: {
    init: (options?: KailyWidgetOptions) => void;
    destroy: () => void;
  };
}
