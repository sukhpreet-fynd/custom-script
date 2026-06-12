import { CopilotPlatform, type CopilotBot, type Environment } from '@kaily-ai/chat-sdk';

export type KailyClientOptions = {
  token: string;
  environment: Environment;
  surfaceClient: string;
  debug?: boolean;
};

export type StreamHandlers = {
  onDelta: (content: string) => void;
  onReply: (payload: unknown, threadId?: string) => void;
  onProgress: (content: string, progress?: number) => void;
  onToolMessage: (content: string) => void;
};

export class KailyChatClient {
  private bot?: CopilotBot;
  private readonly instanceId = `chat-ui-${crypto.randomUUID()}`;

  async connect(options: KailyClientOptions): Promise<void> {
    this.disconnect();

    const platform = CopilotPlatform.createInstance(this.instanceId, {
      environment: options.environment,
      surfaceClient: options.surfaceClient,
      debug: options.debug ?? false,
    });

    this.bot = await platform.createBotInstance(options.token);

    await this.bot.setContext({
      app: 'kaily-chat-bot-ui',
      surfaceClient: options.surfaceClient,
      page: window.location.pathname,
      url: window.location.href,
    });

    await this.bot.addTool({
      name: 'get_browser_context',
      description: 'Read lightweight browser context for the current chat session.',
      timeout: 3000,
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => ({
        path: window.location.pathname,
        title: document.title,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language,
      }),
    });
  }

  disconnect(): void {
    if (!this.bot) return;
    this.bot.destroy();
    this.bot = undefined;
  }

  async sendMessage(text: string, threadId: string | undefined, handlers: StreamHandlers): Promise<string | undefined> {
    if (!this.bot) {
      throw new Error('Connect your Kaily copilot before sending a message.');
    }

    const result = await this.bot.message(
      {
        text,
        thread_id: threadId,
      } as any,
      {
        deltaListener: (response: any) => {
          handlers.onDelta(response?.data?.content ?? '');
        },
        replyListener: (response: any) => {
          handlers.onReply(response?.data, response?.thread_id);
        },
        progressListener: (response: any) => {
          handlers.onProgress(response?.data?.content ?? '', response?.data?.progress);
        },
        toolMessageListener: (response: any) => {
          handlers.onToolMessage(response?.data?.content ?? '');
        },
        toolComponentMessageListener: (response: any) => {
          handlers.onToolMessage(response?.data?.content ?? '');
        },
      },
    );

    return result.thread_id;
  }

  async stopMessage(threadId?: string): Promise<void> {
    if (!this.bot) return;
    await this.bot.stopMessage({ thread_id: threadId });
  }

  async getThreads(): Promise<any[]> {
    if (!this.bot) return [];
    const response = await this.bot.getThreads({ page: 1, limit: 20 });
    const data = response?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.threads)) return data.threads;
    return [];
  }

  async deleteThread(threadId: string): Promise<void> {
    if (!this.bot) return;
    await this.bot.deleteThread(threadId);
  }
}
