import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Bot, User, Loader2, AlertCircle, Paperclip, X, Image as ImageIcon, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface UploadedImage {
  data: string; // base64 data URI
  name: string;
}

interface ChatPanelProps {
  apiKey: string;
}

const MODELS = [
  { id: 'agnes-2.0-flash', label: 'agnes-2.0-flash (empfohlen)' },
];

export default function ChatPanel({ apiKey }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('Du bist ein hilfreicher KI-Assistent. Antworte auf Deutsch, es sei denn, der Nutzer schreibt auf einer anderen Sprache.');
  const [showSystem, setShowSystem] = useState(false);
  const [model, setModel] = useState('agnes-2.0-flash');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [topP, setTopP] = useState(1.0);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0);
  const [presencePenalty, setPresencePenalty] = useState(0);
  const [stopSequences, setStopSequences] = useState('');
  const [thinkingMode, setThinkingMode] = useState(false);
  const [budgetTokens, setBudgetTokens] = useState(2048);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = ev.target?.result as string;
        setUploadedImages(prev => [...prev, { data, name: file.name }]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    if ((!input.trim() && uploadedImages.length === 0) || loading) return;
    setError('');

    const userContent: string[] = [];
    if (input.trim()) {
      userContent.push(input.trim());
    }
    for (const img of uploadedImages) {
      userContent.push(`![${img.name}](${img.data})`);
    }

    const userMessage: Message = { role: 'user', content: userContent.join('\n') };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setUploadedImages([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setLoading(true);

    const apiMessages: { role: string; content: unknown }[] = [];
    if (systemPrompt.trim()) {
      apiMessages.push({ role: 'system', content: systemPrompt.trim() });
    }

    // Build messages with image support
    for (const msg of newMessages) {
      if (msg.role === 'user' && msg.content.includes('![')) {
        // Parse content for images
        const parts: { type: string; text?: string; image_url?: { url: string } }[] = [];
        const lines = msg.content.split('\n');
        for (const line of lines) {
          const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
          if (imgMatch) {
            parts.push({ type: 'image_url', image_url: { url: imgMatch[2] } });
          } else {
            parts.push({ type: 'text', text: line });
          }
        }
        apiMessages.push({ role: 'user', content: parts });
      } else {
        apiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    try {
      const body: Record<string, unknown> = {
        model,
        messages: apiMessages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        stream: true,
      };

      if (stopSequences.trim()) {
        body.stop = stopSequences.split(',').map(s => s.trim()).filter(Boolean);
      }

      if (thinkingMode) {
        body.extra_body = {
          reasoning: {
            effort: 'medium',
          },
          budget_tokens: budgetTokens,
        };
      }

      const response = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
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
        <div className="flex items-center gap-3 flex-wrap">
          {/* Model selection */}
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            className="text-xs font-mono bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2 py-1 rounded-lg focus:outline-none"
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Temp:</label>
            <input
              type="range" min="0" max="2" step="0.1" value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              className="w-16 accent-purple-500"
            />
            <span className="text-xs text-slate-300 w-7">{temperature}</span>
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

          {/* Thinking Mode */}
          <button
            onClick={() => setThinkingMode(!thinkingMode)}
            className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
              thinkingMode
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Brain className="w-3 h-3" />
            Thinking
          </button>

          <button
            onClick={() => setShowSystem(!showSystem)}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            {showSystem ? '▼ System' : '► System'}
          </button>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            {showAdvanced ? '▼ Erweitert' : '► Erweitert'}
          </button>

          <button
            onClick={() => { setMessages([]); setError(''); }}
            className="ml-auto text-xs text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Löschen
          </button>
        </div>

        {/* System Prompt */}
        {showSystem && (
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            rows={2}
            placeholder="System Prompt..."
            className="mt-2 w-full bg-[#0f0f1a] border border-[#2d2d52] rounded-xl px-3 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
          />
        )}

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="mt-2 p-3 bg-[#0f0f1a] border border-[#2d2d52] rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Top-P: {topP}</label>
                <input
                  type="range" min="0" max="1" step="0.05" value={topP}
                  onChange={e => setTopP(parseFloat(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Frequency Penalty: {frequencyPenalty}</label>
                <input
                  type="range" min="-2" max="2" step="0.1" value={frequencyPenalty}
                  onChange={e => setFrequencyPenalty(parseFloat(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Presence Penalty: {presencePenalty}</label>
                <input
                  type="range" min="-2" max="2" step="0.1" value={presencePenalty}
                  onChange={e => setPresencePenalty(parseFloat(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
            </div>
            {thinkingMode && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Budget Tokens: {budgetTokens}</label>
                <input
                  type="range" min="512" max="8192" step="512" value={budgetTokens}
                  onChange={e => setBudgetTokens(parseInt(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Stop Sequences (komma-getrennt)</label>
              <input
                type="text"
                value={stopSequences}
                onChange={e => setStopSequences(e.target.value)}
                placeholder="z.B. stop,bye,exit"
                className="w-full bg-[#1a1a2e] border border-[#2d2d52] rounded-lg px-3 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
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
              Text-Chat mit Reasoning, Coding, Tool-Calling, Bildverständnis und mehr.
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
                <div className="text-sm whitespace-pre-wrap">
                  {msg.content.split('\n').map((line, j) => {
                    const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
                    if (imgMatch) {
                      return (
                        <img
                          key={j}
                          src={imgMatch[2]}
                          alt={imgMatch[1]}
                          className="max-w-[200px] max-h-[200px] rounded-lg my-1 object-cover"
                        />
                      );
                    }
                    return <span key={j}>{line}<br /></span>;
                  })}
                </div>
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
        {/* Uploaded image previews */}
        {uploadedImages.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {uploadedImages.map((img, i) => (
              <div key={i} className="relative group">
                <img
                  src={img.data}
                  alt={img.name}
                  className="w-16 h-16 rounded-lg object-cover border border-[#2d2d52]"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-[#242442] hover:bg-[#2d2d52] border border-[#2d2d52] flex items-center justify-center transition-all"
            title="Bild hochladen"
          >
            <Paperclip className="w-5 h-5 text-slate-400" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
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
            disabled={(!input.trim() && uploadedImages.length === 0) || loading}
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Send className="w-5 h-5 text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
}