import { useState } from 'react';
import { Key, Eye, EyeOff, ExternalLink, CheckCircle } from 'lucide-react';

interface ApiKeyInputProps {
  apiKey: string;
  setApiKey: (key: string) => void;
}

export default function ApiKeyInput({ apiKey, setApiKey }: ApiKeyInputProps) {
  const [show, setShow] = useState(false);
  const [inputVal, setInputVal] = useState(apiKey);

  const handleSave = () => {
    const trimmed = inputVal.trim();
    setApiKey(trimmed);
    localStorage.setItem('agnes_api_key', trimmed);
  };

  return (
    <div className="animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#1a1a2e] border border-[#2d2d52] rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
              <Key className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">API-Key Konfiguration</h2>
              <p className="text-sm text-slate-400">Dein Schlüssel wird nur lokal gespeichert</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Agnes AI API Key</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder="Dein Agnes AI API Key eingeben..."
                  className="w-full bg-[#0f0f1a] border border-[#2d2d52] rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
                />
                <button
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={!inputVal.trim()}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {apiKey ? '✓ Key aktualisieren' : 'Key speichern & loslegen'}
            </button>

            {apiKey && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>API Key ist gespeichert und aktiv</span>
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-[#242442] rounded-xl border border-[#2d2d52]">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Wie bekomme ich einen API Key?</h3>
            <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
              <li>Registriere dich kostenlos auf <a href="https://platform.agnes-ai.com/" target="_blank" rel="noopener" className="text-purple-400 hover:text-purple-300 underline">platform.agnes-ai.com</a></li>
              <li>Gehe zu den API-Key Einstellungen</li>
              <li>Erstelle einen neuen API Key und kopiere ihn</li>
              <li>Füge ihn oben ein – fertig!</li>
            </ol>
            <a
              href="https://platform.agnes-ai.com/"
              target="_blank"
              rel="noopener"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Agnes AI Platform öffnen
            </a>
          </div>

          <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <p className="text-xs text-purple-300">
              🔒 Dein API Key wird ausschließlich in deinem Browser (localStorage) gespeichert und niemals an Dritte übertragen. Alle API-Aufrufe gehen direkt von deinem Browser an die Agnes AI Server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
