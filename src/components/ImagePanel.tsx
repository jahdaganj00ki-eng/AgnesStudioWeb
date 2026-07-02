import { useState } from 'react';
import { Image, Loader2, Download, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';

interface GeneratedImage {
  url: string;
  prompt: string;
  model: string;
  size: string;
  timestamp: number;
}

interface ImagePanelProps {
  apiKey: string;
}

export default function ImagePanel({ apiKey }: ImagePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<'agnes-image-2.1-flash' | 'agnes-image-2.0-flash'>('agnes-image-2.1-flash');
  const [size, setSize] = useState('1024x1024');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);

  const sizes = [
    { value: '1024x1024', label: '1024×1024 (Quadrat)' },
    { value: '1792x1024', label: '1792×1024 (Landscape)' },
    { value: '1024x1792', label: '1024×1792 (Portrait)' },
    { value: '1024x768', label: '1024×768 (4:3)' },
    { value: '768x1024', label: '768×1024 (3:4)' },
  ];

  const generateImage = async () => {
    if (!prompt.trim() || loading) return;
    setError('');
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        model,
        prompt: prompt.trim(),
        size,
        n: 1,
        extra_body: {
          response_format: 'url',
        },
      };

      const response = await fetch('https://apihub.agnes-ai.com/v1/images/generations', {
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

      const data = await response.json();
      const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;

      if (!imageUrl) {
        throw new Error('Keine Bild-URL in der Antwort erhalten');
      }

      const newImage: GeneratedImage = {
        url: imageUrl.startsWith('data:') ? imageUrl : imageUrl,
        prompt: prompt.trim(),
        model,
        size,
        timestamp: Date.now(),
      };

      setImages(prev => [newImage, ...prev]);
      setSelectedImage(newImage);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const examplePrompts = [
    'A luminous floating city above a misty canyon at sunrise, cinematic realism',
    'Ein süßes Roboter-Kätzchen in einer futuristischen Stadt, Anime-Stil',
    'Fotorealistisches Produktfoto einer eleganten Parfümflasche, Studiobeleuchtung',
    'Abstraktes Gemälde in Öl, kosmische Farben, Galaxien und Nebel',
  ];

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/20 rounded-full px-4 py-1.5 mb-3">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300">KI-Bildgenerierung</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Bilder erstellen</h2>
            <p className="text-sm text-slate-400 mt-1">Verwende agnes-image-2.0-flash oder agnes-image-2.1-flash</p>
          </div>

          {/* Config */}
          <div className="bg-[#1a1a2e] border border-[#2d2d52] rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Modell</label>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value as typeof model)}
                  className="w-full bg-[#0f0f1a] border border-[#2d2d52] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="agnes-image-2.1-flash">agnes-image-2.1-flash (empfohlen)</option>
                  <option value="agnes-image-2.0-flash">agnes-image-2.0-flash</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Größe</label>
                <select
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  className="w-full bg-[#0f0f1a] border border-[#2d2d52] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  {sizes.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Prompt</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    generateImage();
                  }
                }}
                rows={3}
                placeholder="Beschreibe das Bild, das du generieren möchtest..."
                className="w-full bg-[#0f0f1a] border border-[#2d2d52] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 resize-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {examplePrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(p)}
                  className="text-xs bg-[#242442] hover:bg-[#2d2d52] border border-[#2d2d52] rounded-lg px-2.5 py-1.5 text-slate-400 hover:text-slate-200 transition-colors truncate max-w-[250px]"
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={generateImage}
              disabled={!prompt.trim() || loading}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Bild wird generiert...
                </>
              ) : (
                <>
                  <Image className="w-5 h-5" />
                  Bild generieren
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Selected / latest image */}
          {selectedImage && (
            <div className="bg-[#1a1a2e] border border-[#2d2d52] rounded-2xl overflow-hidden">
              <div className="relative group">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.prompt}
                  className="w-full max-h-[600px] object-contain bg-black/50"
                  loading="lazy"
                />
                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={selectedImage.url}
                    download
                    target="_blank"
                    rel="noopener"
                    className="p-2 bg-black/70 rounded-lg text-white hover:bg-black transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => { setPrompt(selectedImage.prompt); }}
                    className="p-2 bg-black/70 rounded-lg text-white hover:bg-black transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-[#2d2d52]">
                <p className="text-sm text-slate-300">{selectedImage.prompt}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">{selectedImage.model}</span>
                  <span className="text-xs text-slate-500">{selectedImage.size}</span>
                </div>
              </div>
            </div>
          )}

          {/* Gallery */}
          {images.length > 1 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Galerie ({images.length} Bilder)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((img) => (
                  <button
                    key={img.timestamp}
                    onClick={() => setSelectedImage(img)}
                    className={`rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.02] ${
                      selectedImage?.timestamp === img.timestamp
                        ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                        : 'border-[#2d2d52]'
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={img.prompt}
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {images.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <Image className="w-10 h-10 text-purple-400" />
              </div>
              <p className="text-slate-400 text-sm">Beschreibe ein Bild und klicke auf „Generieren"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
