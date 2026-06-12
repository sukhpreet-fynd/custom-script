import type { Environment } from '@kaily-ai/chat-sdk';

export type ChatEnvironment = Environment;

export type ChatSettings = {
  token: string;
  environment: ChatEnvironment;
  surfaceClient: string;
};

const validEnvironments = new Set<ChatEnvironment>(['production', 'uat', 'sit']);
const defaultAgentToken = 'cat-ze9gbd11';

function readViteEnv(key: string): string | undefined {
  const env = typeof import.meta !== 'undefined' ? (import.meta as ImportMeta).env : undefined;
  return env?.[key as keyof ImportMetaEnv] as string | undefined;
}

export function normalizeEnvironment(value?: string): ChatEnvironment {
  return validEnvironments.has(value as ChatEnvironment) ? (value as ChatEnvironment) : 'uat';
}

export function getDefaultSettings(overrides: Partial<ChatSettings> = {}): ChatSettings {
  return {
    token: overrides.token ?? readViteEnv('VITE_KAILY_APP_TOKEN') ?? defaultAgentToken,
    environment: normalizeEnvironment(overrides.environment ?? readViteEnv('VITE_KAILY_ENVIRONMENT')),
    surfaceClient: overrides.surfaceClient ?? readViteEnv('VITE_KAILY_SURFACE_CLIENT') ?? 'web',
  };
}
