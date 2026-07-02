import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Bot, User, Loader2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatPanelProps {
  apiKey: string;
}

export default function ChatPanel({ apiKey }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('Du bist ein hilfreicher KI-Assistent. Antworte auf Deutsch, es sei denn, der Nutzer schreibt auf einer anderen Sprache.');
  const [showSystem, setShowSystem] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const autoResize = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    setError('');

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setLoading(true);

    const apiMessages: Message[] = [];
    if (systemPrompt.trim()) {
      apiMessages.push({ role: 'system', content: systemPrompt.trim() });
    }
    apiMessages.push(...newMessages);

    try {
      const response = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'agnes-2.0-flash',
          messages: apiMessages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API Fehler: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(l => l.trim().startsWith('data:'));

          for (const line of lines) {
            const data = line.replace('data: ', '').trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                assistantContent += delta;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                  return updated;
                });
              }
            } catch {
              // skip invalid JSON chunks
            }
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(message);
      // Remove the empty assistant message on error
      setMessages(prev => {
        if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && prev[prev.length - 1].content === '') {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Settings bar */}
      <div className="flex-shrink-0 border-b border-[#2d2d52] bg-[#1a1a2e]/80 backdrop-blur-sm px-4 py-2">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-1 rounded-lg">agnes-2.0-flash</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Temp:</label>
            <input
              type="range" min="0" max="2" step="0.1" value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              className="w-20 accent-purple-500"
            />
            <span className="text-xs text-slate-300 w-8">{temperature}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Max Tokens:</label>
            <select
              value={maxTokens}
              onChange={e => setMaxTokens(parseInt(e.target.value))}
              className="bg-[#242442] text-xs text-slate-300 rounded-lg px-2 py-1 border border-[#2d2d52]"
            >
              <option value={512}>512</option>
              <option value={1024}>1024</option>
              <option value={2048}>2048</option>
              <option value={4096}>4096</option>
              <option value={8192}>8192</option>
            </select>
          </div>
          <button
            onClick={() => setShowSystem(!showSystem)}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            {showSystem ? '▼ System Prompt' : '► System Prompt'}
          </button>
          <button
            onClick={() => { setMessages([]); setError(''); }}
            className="ml-auto text-xs text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Chat löschen
          </button>
        </div>
        {showSystem && (
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            rows={2}
            placeholder="System Prompt..."
            className="mt-2 w-full bg-[#0f0f1a] border border-[#2d2d52] rounded-xl px-3 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
          />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/20 flex items-center justify-center mb-4">
              <Bot className="w-10 h-10 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Agnes 2.0 Flash</h3>
            <p className="text-sm text-slate-400 max-w-md">
              Text-Chat mit Reasoning, Coding, Tool-Calling und mehr. Stelle eine Frage, um loszulegen!
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg">
              {[
                'Erkläre mir Quantencomputing in einfachen Worten',
                'Schreibe eine Python-Funktion für Fibonacci',
                'Was sind die Vorteile von TypeScript?',
                'Erstelle ein Haiku über künstliche Intelligenz',
              ].map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(q); }}
                  className="text-left text-xs bg-[#242442] hover:bg-[#2d2d52] border border-[#2d2d52] rounded-xl px-3 py-2.5 text-slate-300 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-purple-600 text-white'
                : 'bg-[#1a1a2e] border border-[#2d2d52] text-slate-200'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="markdown-body text-sm">
                  <ReactMarkdown>{msg.content || '...'}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#242442] border border-[#2d2d52] flex items-center justify-center mt-1">
                <User className="w-4 h-4 text-slate-300" />
              </div>
            )}
          </div>
        ))}

        {loading && messages.length > 0 && messages[messages.length - 1].content === '' && (
          <div className="flex items-center gap-2 text-purple-400 text-sm px-12">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Agnes denkt nach...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-[#2d2d52] bg-[#1a1a2e]/80 backdrop-blur-sm px-4 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); autoResize(); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            rows={1}
            placeholder="Nachricht eingeben... (Shift+Enter für neue Zeile)"
            className="flex-1 bg-[#0f0f1a] border border-[#2d2d52] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 resize-none transition-all"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Send className="w-5 h-5 text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
}
