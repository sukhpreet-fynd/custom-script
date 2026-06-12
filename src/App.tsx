import {
  Bot,
  ChevronDown,
  Ellipsis,
  Loader2,
  MessageSquarePlus,
  Mic,
  Paperclip,
  RefreshCw,
  Send,
  StopCircle,
  X,
} from 'lucide-react';
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatSettings } from './env';
import { getDefaultSettings } from './env';
import { KailyChatClient } from './kailyClient';
import './styles.css';

type Role = 'assistant' | 'user' | 'system';

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  status?: string;
};

type AppProps = {
  embedded?: boolean;
  initialSettings?: Partial<ChatSettings>;
};

const starters = ['How can Kaily help me?', 'What integrations can I use?', 'Is there a free plan?', 'Can I see a demo?'];

const introMessages: ChatMessage[] = [
  {
    id: 'intro-1',
    role: 'assistant',
    content: 'Hey! Want to deploy a conversational AI agent?',
  },
  {
    id: 'intro-2',
    role: 'assistant',
    content: 'Let me help you figure out if Kaily is the right fit.',
  },
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

function nowId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App({ embedded = false, initialSettings = {} }: AppProps) {
  const [settings] = useState<ChatSettings>(() => getDefaultSettings(initialSettings));
  const [messages, setMessages] = useState<ChatMessage[]>(introMessages);
  const [currentThreadId, setCurrentThreadId] = useState<string>();
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'sending' | 'error'>('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(true);

  const clientRef = useRef<KailyChatClient | null>(null);
  const assistantMessageIdRef = useRef<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const canSend = status === 'connected' && draft.trim().length > 0;
  const connected = status === 'connected' || status === 'sending';

  const connectionLabel = useMemo(() => {
    if (status === 'connecting') return 'Connecting';
    if (status === 'sending') return 'Streaming';
    if (status === 'connected') return 'Online';
    if (status === 'error') return 'Unavailable';
    return 'Starting';
  }, [status]);

  useEffect(() => {
    clientRef.current = new KailyChatClient();
    void connect();

    return () => clientRef.current?.disconnect();
  }, []);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, progress]);

  async function connect() {
    if (!settings.token) {
      setStatus('error');
      setError('Kaily agent token is missing from the widget build.');
      return;
    }

    try {
      setStatus('connecting');
      setError('');
      await clientRef.current?.connect(settings);
      setStatus('connected');
    } catch (connectError) {
      setStatus('error');
      setError(connectError instanceof Error ? connectError.message : 'Unable to connect to Kaily.');
    }
  }

  function newChat() {
    setCurrentThreadId(undefined);
    setProgress('');
    setError('');
    setMessages(introMessages.map((message) => ({ ...message, id: nowId(message.id) })));
  }

  async function send(text = draft) {
    const trimmed = text.trim();
    if (!trimmed || status === 'sending') return;

    if (status !== 'connected') {
      await connect();
      if (status === 'error') return;
    }

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
    setError('');
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
          if (!finalText) return;

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
                content: 'I could not complete that request. Please try again.',
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

  if (minimized) {
    return (
      <main className={embedded ? 'app app-embedded' : 'app'}>
        <button className="widget-launcher" type="button" onClick={() => setMinimized(false)} aria-label="Open Kaily chat">
          <Bot size={28} aria-hidden="true" />
        </button>
      </main>
    );
  }

  return (
    <main className={embedded ? 'app app-embedded' : 'app'}>
      <section className="widget-shell" aria-label="Kaily chatbot">
        <header className="widget-header">
          <div className="widget-title">
            <span className="widget-logo">
              <Bot size={24} aria-hidden="true" />
            </span>
            <div>
              <h1>Kaily AI Agent</h1>
              <p className={`connection-text status-${status}`}>{connectionLabel}</p>
            </div>
          </div>
          <div className="widget-actions">
            <button className="header-button" type="button" onClick={newChat} aria-label="New chat" title="New chat">
              <MessageSquarePlus size={18} aria-hidden="true" />
            </button>
            <button className="header-button" type="button" onClick={() => void connect()} aria-label="Reconnect" title="Reconnect">
              <RefreshCw size={18} aria-hidden="true" />
            </button>
            <button className="header-button" type="button" aria-label="More options" title="More options">
              <Ellipsis size={22} aria-hidden="true" />
            </button>
            <button className="header-button" type="button" onClick={() => setMinimized(true)} aria-label="Close chat" title="Close chat">
              <X size={21} aria-hidden="true" />
            </button>
          </div>
        </header>

        <section className="chat-panel">
          {error ? <div className="error-banner">{error}</div> : null}

          <div className="transcript" ref={transcriptRef}>
            {messages.map((message) => (
              <article className={`message message-${message.role}`} key={message.id}>
                <div className="message-bubble">
                  {message.status ? (
                    <span className="typing">
                      <Loader2 size={16} aria-hidden="true" />
                      {message.status}
                    </span>
                  ) : null}
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

          <div className="powered-by">
            <span>K</span>
            Powered by Kaily
          </div>

          {privacyVisible ? (
            <div className="privacy-strip">
              <p>
                By chatting, you agree to our <a href="https://kaily.ai" target="_blank" rel="noreferrer">privacy policy</a>.
              </p>
              <button type="button" onClick={() => setPrivacyVisible(false)} aria-label="Dismiss notice">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <form className="composer" onSubmit={handleSubmit}>
            <button className="composer-tool" type="button" aria-label="Attach file" title="Attach file">
              <Paperclip size={20} aria-hidden="true" />
            </button>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={connected ? 'Ask me anything about Kaily' : 'Connecting to Kaily'}
              rows={1}
            />
            <button className="composer-tool" type="button" aria-label="Voice input" title="Voice input">
              <Mic size={20} aria-hidden="true" />
            </button>
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
      <button className="widget-dock" type="button" onClick={() => setMinimized(true)} aria-label="Minimize Kaily chat">
        <ChevronDown size={30} aria-hidden="true" />
      </button>
    </main>
  );
}
