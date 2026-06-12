import {
  Bot,
  Check,
  Loader2,
  MessageSquarePlus,
  PlugZap,
  RefreshCw,
  Send,
  Settings,
  StopCircle,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatSettings } from './env';
import { getDefaultSettings, normalizeEnvironment, type ChatEnvironment } from './env';
import { KailyChatClient } from './kailyClient';
import './styles.css';

type Role = 'assistant' | 'user' | 'system';

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  status?: string;
};

type ThreadSummary = {
  id: string;
  title: string;
  updatedAt?: string;
};

type AppProps = {
  embedded?: boolean;
  initialSettings?: Partial<ChatSettings>;
};

const starters = [
  'What can you help me do?',
  'Summarize what this copilot can do.',
  'Help me troubleshoot an order issue.',
];

function extractReplyText(payload: any): string {
  const messages = payload?.messages;
  if (Array.isArray(messages) && messages.length > 0) {
    return messages
      .map((message) => message?.content)
      .filter(Boolean)
      .join('\n\n');
  }

  if (typeof payload?.content === 'string') return payload.content;
  if (typeof payload?.message === 'string') return payload.message;
  return '';
}

function normalizeThreads(items: any[]): ThreadSummary[] {
  return items
    .map((item) => {
      const id = String(item?.id ?? item?.thread_id ?? item?.threadId ?? '');
      if (!id) return null;
      return {
        id,
        title: String(item?.title ?? item?.name ?? item?.text ?? 'Untitled chat'),
        updatedAt: item?.updatedAt ?? item?.updated_at ?? item?.createdAt ?? item?.created_at,
      };
    })
    .filter(Boolean) as ThreadSummary[];
}

function nowId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App({ embedded = false, initialSettings = {} }: AppProps) {
  const [settings, setSettings] = useState<ChatSettings>(() => getDefaultSettings(initialSettings));
  const [tokenInput, setTokenInput] = useState(settings.token);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Connect your Kaily copilot and start a conversation.',
    },
  ]);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string>();
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'sending' | 'error'>('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(!settings.token);

  const clientRef = useRef<KailyChatClient | null>(null);
  const assistantMessageIdRef = useRef<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const canSend = status === 'connected' && draft.trim().length > 0;
  const connected = status === 'connected' || status === 'sending';

  const connectionLabel = useMemo(() => {
    if (status === 'connecting') return 'Connecting';
    if (status === 'sending') return 'Streaming';
    if (status === 'connected') return 'Connected';
    if (status === 'error') return 'Needs attention';
    return 'Disconnected';
  }, [status]);

  useEffect(() => {
    clientRef.current = new KailyChatClient();
    return () => clientRef.current?.disconnect();
  }, []);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, progress]);

  useEffect(() => {
    if (settings.token) {
      void connect(settings);
    }
  }, []);

  async function connect(nextSettings = settings) {
    const token = tokenInput.trim() || nextSettings.token.trim();
    if (!token) {
      setSettingsOpen(true);
      setError('Add a Kaily copilot app token to connect.');
      setStatus('error');
      return;
    }

    const normalized: ChatSettings = {
      token,
      environment: normalizeEnvironment(nextSettings.environment),
      surfaceClient: nextSettings.surfaceClient.trim() || 'kaily-chat-bot-ui',
    };

    try {
      setStatus('connecting');
      setError('');
      await clientRef.current?.connect(normalized);
      setSettings(normalized);
      setTokenInput(normalized.token);
      setStatus('connected');
      setSettingsOpen(false);
      setMessages((items) =>
        items[0]?.id === 'welcome'
          ? [
              {
                id: 'connected',
                role: 'assistant',
                content: 'Connected. Ask a question or choose a starter prompt.',
              },
            ]
          : items,
      );
      await refreshThreads();
    } catch (connectError) {
      setStatus('error');
      setSettingsOpen(true);
      setError(connectError instanceof Error ? connectError.message : 'Unable to connect to Kaily.');
    }
  }

  async function refreshThreads() {
    const items = await clientRef.current?.getThreads();
    setThreads(normalizeThreads(items ?? []));
  }

  function newChat() {
    setCurrentThreadId(undefined);
    setProgress('');
    setMessages([
      {
        id: nowId('new'),
        role: 'assistant',
        content: 'New conversation ready.',
      },
    ]);
  }

  async function deleteThread(threadId: string) {
    await clientRef.current?.deleteThread(threadId);
    setThreads((items) => items.filter((item) => item.id !== threadId));
    if (currentThreadId === threadId) newChat();
  }

  async function send(text = draft) {
    const trimmed = text.trim();
    if (!trimmed || status === 'sending') return;

    const userMessage: ChatMessage = {
      id: nowId('user'),
      role: 'user',
      content: trimmed,
    };
    const assistantMessage: ChatMessage = {
      id: nowId('assistant'),
      role: 'assistant',
      content: '',
      status: 'Thinking',
    };

    assistantMessageIdRef.current = assistantMessage.id;
    setDraft('');
    setProgress('');
    setStatus('sending');
    setMessages((items) => [...items, userMessage, assistantMessage]);

    try {
      const nextThreadId = await clientRef.current?.sendMessage(trimmed, currentThreadId, {
        onDelta: (content) => {
          if (!content) return;
          const targetId = assistantMessageIdRef.current;
          setMessages((items) =>
            items.map((item) =>
              item.id === targetId
                ? {
                    ...item,
                    content: `${item.content}${content}`,
                    status: undefined,
                  }
                : item,
            ),
          );
        },
        onReply: (payload, threadId) => {
          const finalText = extractReplyText(payload);
          const targetId = assistantMessageIdRef.current;
          if (threadId) setCurrentThreadId(threadId);
          if (finalText) {
            setMessages((items) =>
              items.map((item) =>
                item.id === targetId
                  ? {
                      ...item,
                      content: finalText,
                      status: undefined,
                    }
                  : item,
              ),
            );
          }
        },
        onProgress: (content, percent) => {
          if (!content) return;
          setProgress(percent == null ? content : `${percent}% ${content}`);
        },
        onToolMessage: (content) => {
          if (!content) return;
          setProgress(content);
        },
      });

      if (nextThreadId) setCurrentThreadId(nextThreadId);
      setStatus('connected');
      setProgress('');
      await refreshThreads();
    } catch (sendError) {
      setStatus('connected');
      setProgress('');
      setError(sendError instanceof Error ? sendError.message : 'Message failed.');
      const targetId = assistantMessageIdRef.current;
      setMessages((items) =>
        items.map((item) =>
          item.id === targetId
            ? {
                ...item,
                content: 'I could not complete that request. Check the token, environment, and network access.',
                status: undefined,
              }
            : item,
        ),
      );
    }
  }

  async function stop() {
    await clientRef.current?.stopMessage(currentThreadId);
    setStatus('connected');
    setProgress('');
    setMessages((items) =>
      items.map((item) =>
        item.id === assistantMessageIdRef.current && !item.content
          ? { ...item, content: 'Generation stopped.', status: undefined }
          : item,
      ),
    );
  }

  function handleEnvironmentChange(environment: ChatEnvironment) {
    setSettings((current) => ({ ...current, environment }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <main className={embedded ? 'app app-embedded' : 'app'}>
      <section className="shell" aria-label="Kaily chatbot">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-icon">
              <Bot size={22} aria-hidden="true" />
            </span>
            <div>
              <h1>Kaily Chat</h1>
              <p>{connectionLabel}</p>
            </div>
          </div>

          <div className={`status-pill status-${status}`}>
            {connected ? <Check size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
            <span>{settings.environment}</span>
          </div>

          <div className="sidebar-actions">
            <button className="icon-button" type="button" onClick={newChat} aria-label="New chat" title="New chat">
              <MessageSquarePlus size={18} aria-hidden="true" />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => void refreshThreads()}
              aria-label="Refresh threads"
              title="Refresh threads"
            >
              <RefreshCw size={18} aria-hidden="true" />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => setSettingsOpen((value) => !value)}
              aria-label="Connection settings"
              title="Connection settings"
            >
              <Settings size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="thread-list" aria-label="Threads">
            {threads.length === 0 ? (
              <p className="empty-copy">No saved threads yet.</p>
            ) : (
              threads.map((thread) => (
                <div className="thread-row" data-active={thread.id === currentThreadId} key={thread.id}>
                  <button className="thread-button" type="button" onClick={() => setCurrentThreadId(thread.id)}>
                    <span>{thread.title}</span>
                    {thread.updatedAt ? <time>{new Date(thread.updatedAt).toLocaleDateString()}</time> : null}
                  </button>
                  <button
                    className="delete-button"
                    type="button"
                    onClick={() => void deleteThread(thread.id)}
                    aria-label={`Delete ${thread.title}`}
                    title="Delete thread"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        <section className="chat-panel">
          {settingsOpen ? (
            <form
              className="settings-panel"
              onSubmit={(event) => {
                event.preventDefault();
                void connect();
              }}
            >
              <label>
                <span>App token</span>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  placeholder="Paste your Kaily copilot app token"
                  autoComplete="off"
                />
              </label>
              <label>
                <span>Surface client</span>
                <input
                  type="text"
                  value={settings.surfaceClient}
                  onChange={(event) => setSettings((current) => ({ ...current, surfaceClient: event.target.value }))}
                />
              </label>
              <div className="segmented" aria-label="Environment">
                {(['production', 'uat', 'sit'] as ChatEnvironment[]).map((environment) => (
                  <button
                    key={environment}
                    type="button"
                    className={settings.environment === environment ? 'selected' : ''}
                    onClick={() => handleEnvironmentChange(environment)}
                  >
                    {environment}
                  </button>
                ))}
              </div>
              <button className="primary-button" type="submit" disabled={status === 'connecting'}>
                {status === 'connecting' ? <Loader2 size={17} aria-hidden="true" /> : <PlugZap size={17} aria-hidden="true" />}
                Connect
              </button>
            </form>
          ) : null}

          {error ? <div className="error-banner">{error}</div> : null}

          <div className="transcript" ref={transcriptRef}>
            {messages.map((message) => (
              <article className={`message message-${message.role}`} key={message.id}>
                <div className="message-meta">{message.role === 'user' ? 'You' : message.role === 'system' ? 'System' : 'Kaily'}</div>
                <div className="message-bubble">
                  {message.status ? <span className="typing">{message.status}</span> : null}
                  {message.content ? <p>{message.content}</p> : null}
                </div>
              </article>
            ))}
            {progress ? <div className="progress-line">{progress}</div> : null}
          </div>

          <div className="starters" aria-label="Starter prompts">
            {starters.map((starter) => (
              <button key={starter} type="button" onClick={() => void send(starter)} disabled={!connected || status === 'sending'}>
                {starter}
              </button>
            ))}
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={connected ? 'Message your Kaily copilot' : 'Connect before sending a message'}
              rows={1}
            />
            {status === 'sending' ? (
              <button className="stop-button" type="button" onClick={() => void stop()} aria-label="Stop generation" title="Stop generation">
                <StopCircle size={20} aria-hidden="true" />
              </button>
            ) : (
              <button className="send-button" type="submit" disabled={!canSend} aria-label="Send message" title="Send message">
                <Send size={20} aria-hidden="true" />
              </button>
            )}
          </form>
        </section>
      </section>
    </main>
  );
}
