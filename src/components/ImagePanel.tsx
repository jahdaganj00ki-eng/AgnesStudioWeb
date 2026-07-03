import { useState, useRef } from 'react';
import { Image, Loader2, Download, AlertCircle, Sparkles, RefreshCw, Upload, X, SlidersHorizontal } from 'lucide-react';

interface GeneratedImage {
  url: string;
  prompt: string;
  negativePrompt: string;
  model: string;
  size: string;
  cfgScale: number;
  seed: number;
  timestamp: number;
}

interface UploadedImage {
  data: string; // base64 data URI
  name: string;
}

interface ImagePanelProps {
  apiKey: string;
}

type ImageMode = 'text-to-image' | 'image-to-image';

export default function ImagePanel({ apiKey }: ImagePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [model, setModel] = useState<'agnes-image-2.1-flash' | 'agnes-image-2.0-flash'>('agnes-image-2.1-flash');
  const [size, setSize] = useState('1024x1024');
  const [mode, setMode] = useState<ImageMode>('text-to-image');
  const [cfgScale, setCfgScale] = useState(4.5);
  const [seed, setSeed] = useState(-1);
  const [numImages, setNumImages] = useState(1);
  const [responseFormat, setResponseFormat] = useState<'url' | 'b64_json'>('url');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const sizes = [
    { value: '1024x1024', label: '1024×1024 (Quadrat)' },
    { value: '1792x1024', label: '1792×1024 (Landscape)' },
    { value: '1024x1792', label: '1024×1792 (Portrait)' },
    { value: '1024x768', label: '1024×768 (4:3)' },
    { value: '768x1024', label: '768×1024 (3:4)' },
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    // Max 4 images
    const maxNew = 4 - uploadedImages.length;
    const toAdd = Array.from(files).slice(0, maxNew);
    for (const file of toAdd) {
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

  const removeUploadedImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const generateImage = async () => {
    if (!prompt.trim() || loading) return;
    if (mode === 'image-to-image' && uploadedImages.length === 0) {
      setError('Bitte lade mindestens ein Bild für Image-to-Image hoch');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        model,
        prompt: prompt.trim(),
        size,
        n: numImages,
      };

      // response_format in extra_body für Agnes API
      body.extra_body = {
        response_format: responseFormat,
      } as Record<string, unknown>;

      // Negative prompt
      if (negativePrompt.trim()) {
        (body.extra_body as Record<string, unknown>).negative_prompt = negativePrompt.trim();
      }

      // CFG Scale
      (body.extra_body as Record<string, unknown>).cfg_scale = cfgScale;

      // Seed
      if (seed >= 0) {
        (body.extra_body as Record<string, unknown>).seed = seed;
      }

      // Image-to-image: add images
      if (mode === 'image-to-image' && uploadedImages.length > 0) {
        (body.extra_body as Record<string, unknown>).image = uploadedImages.map(img => img.data);
      }

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
      const results = data.data || [];

      if (results.length === 0) {
        throw new Error('Keine Bilder in der Antwort erhalten');
      }

      const newImages: GeneratedImage[] = results.map((item: { url?: string; b64_json?: string }, idx: number) => ({
        url: item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ''),
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        model,
        size,
        cfgScale,
        seed,
        timestamp: Date.now() + idx,
      }));

      setImages(prev => [...newImages, ...prev]);
      setSelectedImage(newImages[0]);
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

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `agnes-image-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

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
            <p className="text-sm text-slate-400 mt-1">Text-zu-Bild & Bild-zu-Bild mit negativem Prompt</p>
          </div>

          {/* Config */}
          <div className="bg-[#1a1a2e] border border-[#2d2d52] rounded-2xl p-5 space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setMode('text-to-image')}
                className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${
                  mode === 'text-to-image'
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#0f0f1a] border border-[#2d2d52] text-slate-400 hover:text-white'
                }`}
              >
                Text-zu-Bild
              </button>
              <button
                onClick={() => setMode('image-to-image')}
                className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${
                  mode === 'image-to-image'
                    ? 'bg-pink-600 text-white'
                    : 'bg-[#0f0f1a] border border-[#2d2d52] text-slate-400 hover:text-white'
                }`}
              >
                Bild-zu-Bild
              </button>
            </div>

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

            {/* Prompt */}
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

            {/* Negative Prompt */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Negativer Prompt (optional)</label>
              <textarea
                value={negativePrompt}
                onChange={e => setNegativePrompt(e.target.value)}
                rows={2}
                placeholder="Was soll NICHT im Bild sein? z.B. deformed, blurry, ugly..."
                className="w-full bg-[#0f0f1a] border border-[#2d2d52] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 resize-none"
              />
            </div>

            {/* Image upload for image-to-image */}
            {mode === 'image-to-image' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Referenzbilder (max. 4)</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {uploadedImages.map((img, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={img.data}
                        alt={img.name}
                        className="w-20 h-20 rounded-xl object-cover border border-[#2d2d52]"
                      />
                      <button
                        onClick={() => removeUploadedImage(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                  {uploadedImages.length < 4 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-[#2d2d52] hover:border-purple-500/50 flex items-center justify-center transition-colors"
                    >
                      <Upload className="w-6 h-6 text-slate-500" />
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            )}

            {/* Examples */}
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

            {/* Advanced Settings Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <SlidersHorizontal className="w-3 h-3" />
              {showAdvanced ? '▼ Erweiterte Einstellungen' : '► Erweiterte Einstellungen'}
            </button>

            {showAdvanced && (
              <div className="p-3 bg-[#0f0f1a] border border-[#2d2d52] rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">CFG Scale: {cfgScale}</label>
                    <input
                      type="range" min="1" max="20" step="0.5" value={cfgScale}
                      onChange={e => setCfgScale(parseFloat(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Seed</label>
                    <input
                      type="number"
                      value={seed}
                      onChange={e => setSeed(parseInt(e.target.value) || -1)}
                      placeholder="-1 = zufällig"
                      className="w-full bg-[#1a1a2e] border border-[#2d2d52] rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Anzahl Bilder</label>
                    <select
                      value={numImages}
                      onChange={e => setNumImages(parseInt(e.target.value))}
                      className="w-full bg-[#0f0f1a] border border-[#2d2d52] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Ausgabeformat</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setResponseFormat('url')}
                      className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                        responseFormat === 'url'
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#1a1a2e] border border-[#2d2d52] text-slate-400'
                      }`}
                    >
                      URL
                    </button>
                    <button
                      onClick={() => setResponseFormat('b64_json')}
                      className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                        responseFormat === 'b64_json'
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#1a1a2e] border border-[#2d2d52] text-slate-400'
                      }`}
                    >
                      Base64
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={generateImage}
              disabled={!prompt.trim() || loading || (mode === 'image-to-image' && uploadedImages.length === 0)}
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
                  {mode === 'text-to-image' ? 'Bild generieren' : 'Bild bearbeiten'}
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
                  <button
                    onClick={() => handleDownload(selectedImage.url)}
                    className="p-2 bg-black/70 rounded-lg text-white hover:bg-black transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setPrompt(selectedImage.prompt); setNegativePrompt(selectedImage.negativePrompt); }}
                    className="p-2 bg-black/70 rounded-lg text-white hover:bg-black transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-[#2d2d52] space-y-1">
                <p className="text-sm text-slate-300">{selectedImage.prompt}</p>
                {selectedImage.negativePrompt && (
                  <p className="text-xs text-red-400/70">Negativ: {selectedImage.negativePrompt}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">{selectedImage.model}</span>
                  <span className="text-xs text-slate-500">{selectedImage.size}</span>
                  <span className="text-xs text-slate-500">CFG: {selectedImage.cfgScale}</span>
                  {selectedImage.seed >= 0 && (
                    <span className="text-xs text-slate-500">Seed: {selectedImage.seed}</span>
                  )}
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