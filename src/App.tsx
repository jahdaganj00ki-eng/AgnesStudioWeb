import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Image,
  Video,
  Settings,
  Zap,
  ExternalLink,
} from 'lucide-react';
import ApiKeyInput from './components/ApiKeyInput';
import ChatPanel from './components/ChatPanel';
import ImagePanel from './components/ImagePanel';
import VideoPanel from './components/VideoPanel';

type Tab = 'chat' | 'image' | 'video' | 'settings';

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('agnes_api_key') || '');
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  // If no API key, show settings
  useEffect(() => {
    if (!apiKey) setActiveTab('settings');
  }, [apiKey]);

  const tabs: { id: Tab; label: string; icon: typeof MessageSquare; color: string }[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, color: 'text-purple-400' },
    { id: 'image', label: 'Bild', icon: Image, color: 'text-pink-400' },
    { id: 'video', label: 'Video', icon: Video, color: 'text-blue-400' },
    { id: 'settings', label: 'Einstellungen', icon: Settings, color: 'text-slate-400' },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#0f0f1a] text-white">
      {/* Top bar */}
      <header className="flex-shrink-0 border-b border-[#2d2d52] bg-[#1a1a2e]/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center pulse-glow">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent leading-tight">
                Agnes AI Studio
              </h1>
              <p className="text-[10px] text-slate-500 leading-tight">Text · Bild · Video – 100% kostenlos</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            {apiKey && (
              <span className="text-[10px] text-green-400 bg-green-400/10 px-2 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                Verbunden
              </span>
            )}
            <a
              href="https://platform.agnes-ai.com/"
              target="_blank"
              rel="noopener"
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              Platform
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://agnes-ai.com/en/docs/"
              target="_blank"
              rel="noopener"
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              Docs
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 gap-1 -mb-px">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id !== 'settings' && !apiKey) {
                    setActiveTab('settings');
                    return;
                  }
                  setActiveTab(tab.id);
                }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all ${
                  isActive
                    ? 'bg-[#0f0f1a] text-white border border-[#2d2d52] border-b-[#0f0f1a]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#242442]/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? tab.color : ''}`} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'settings' && (
          <div className="h-full overflow-y-auto py-8 px-4">
            <ApiKeyInput apiKey={apiKey} setApiKey={(key) => {
              setApiKey(key);
              if (key) setActiveTab('chat');
            }} />

            {/* Model info cards */}
            <div className="max-w-2xl mx-auto mt-8 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300">Verfügbare Modelle</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    name: 'agnes-2.0-flash',
                    type: 'Text & Vision',
                    desc: 'Chat, Reasoning, Coding, Tool-Calling, Streaming, Bildverständnis',
                    endpoint: '/v1/chat/completions',
                    color: 'from-purple-600 to-violet-600',
                  },
                  {
                    name: 'agnes-image-2.0-flash',
                    type: 'Bildgenerierung',
                    desc: 'Text-zu-Bild, Bild-zu-Bild, Multi-Image Komposition',
                    endpoint: '/v1/images/generations',
                    color: 'from-pink-600 to-rose-600',
                  },
                  {
                    name: 'agnes-image-2.1-flash',
                    type: 'Bildgenerierung',
                    desc: 'High-Density Generierung, Bearbeitung, flexible Größen',
                    endpoint: '/v1/images/generations',
                    color: 'from-fuchsia-600 to-pink-600',
                  },
                  {
                    name: 'agnes-video-v2.0',
                    type: 'Videogenerierung',
                    desc: 'Text-zu-Video, Bild-zu-Video, Keyframe-Animation, Async API',
                    endpoint: '/v1/videos',
                    color: 'from-blue-600 to-cyan-600',
                  },
                ].map(m => (
                  <div key={m.name} className="bg-[#1a1a2e] border border-[#2d2d52] rounded-xl p-4">
                    <div className={`inline-block bg-gradient-to-r ${m.color} text-white text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2`}>
                      {m.type}
                    </div>
                    <h4 className="text-sm font-mono font-semibold text-white">{m.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">{m.desc}</p>
                    <p className="text-[10px] text-slate-500 mt-2 font-mono">{m.endpoint}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && apiKey && <ChatPanel apiKey={apiKey} />}
        {activeTab === 'image' && apiKey && <ImagePanel apiKey={apiKey} />}
        {activeTab === 'video' && apiKey && <VideoPanel apiKey={apiKey} />}
      </main>
    </div>
  );
}
