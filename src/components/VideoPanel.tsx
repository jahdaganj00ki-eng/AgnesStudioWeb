import { useState, useEffect, useRef, useCallback } from 'react';
import { Video, Loader2, Download, AlertCircle, Play, Clock, CheckCircle, XCircle } from 'lucide-react';

interface VideoTask {
  taskId: string;
  videoId: string;
  prompt: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  videoUrl?: string;
  error?: string;
  createdAt: number;
}

interface VideoPanelProps {
  apiKey: string;
}

export default function VideoPanel({ apiKey }: VideoPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tasks, setTasks] = useState<VideoTask[]>([]);
  const [width, setWidth] = useState(1152);
  const [height, setHeight] = useState(768);
  const [numFrames, setNumFrames] = useState(121);
  const [frameRate, setFrameRate] = useState(24);
  const pollIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const resolutions = [
    { w: 1152, h: 768, label: '1152×768 (16:9 Landscape)' },
    { w: 768, h: 1152, label: '768×1152 (9:16 Portrait)' },
    { w: 1024, h: 1024, label: '1024×1024 (1:1 Quadrat)' },
    { w: 1024, h: 768, label: '1024×768 (4:3)' },
    { w: 768, h: 1024, label: '768×1024 (3:4)' },
  ];

  const durationPresets = [
    { frames: 81, label: '~3 Sek' },
    { frames: 121, label: '~5 Sek' },
    { frames: 241, label: '~10 Sek' },
    { frames: 441, label: '~18 Sek' },
  ];

  const duration = (numFrames / frameRate).toFixed(1);

  const pollVideoStatus = useCallback(async (videoId: string) => {
    try {
      const response = await fetch(
        `https://apihub.agnes-ai.com/agnesapi?video_id=${videoId}&model_name=agnes-video-v2.0`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        }
      );

      if (!response.ok) return;

      const data = await response.json();

      setTasks(prev =>
        prev.map(t => {
          if (t.videoId !== videoId) return t;
          const updated = { ...t };
          updated.status = data.status || t.status;
          updated.progress = data.progress ?? t.progress;
          if (data.status === 'completed' && data.remixed_from_video_id) {
            updated.videoUrl = data.remixed_from_video_id;
          }
          if (data.status === 'failed') {
            updated.error = data.error?.message || 'Video-Generierung fehlgeschlagen';
          }
          return updated;
        })
      );

      if (data.status === 'completed' || data.status === 'failed') {
        if (pollIntervals.current[videoId]) {
          clearInterval(pollIntervals.current[videoId]);
          delete pollIntervals.current[videoId];
        }
      }
    } catch {
      // silently retry on next interval
    }
  }, [apiKey]);

  const startPolling = useCallback((videoId: string) => {
    // Initial poll after 5 seconds
    setTimeout(() => pollVideoStatus(videoId), 5000);
    // Then every 8 seconds
    pollIntervals.current[videoId] = setInterval(() => pollVideoStatus(videoId), 8000);
  }, [pollVideoStatus]);

  useEffect(() => {
    return () => {
      Object.values(pollIntervals.current).forEach(clearInterval);
    };
  }, []);

  const createVideoTask = async () => {
    if (!prompt.trim() || loading) return;
    setError('');
    setLoading(true);

    try {
      const response = await fetch('https://apihub.agnes-ai.com/v1/videos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'agnes-video-v2.0',
          prompt: prompt.trim(),
          height,
          width,
          num_frames: numFrames,
          frame_rate: frameRate,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API Fehler: ${response.status}`);
      }

      const data = await response.json();

      const task: VideoTask = {
        taskId: data.task_id || data.id,
        videoId: data.video_id,
        prompt: prompt.trim(),
        status: data.status || 'queued',
        progress: data.progress || 0,
        createdAt: Date.now(),
      };

      setTasks(prev => [task, ...prev]);
      startPolling(data.video_id);
      setPrompt('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'in_progress':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'queued': return 'In Warteschlange';
      case 'in_progress': return 'Wird generiert';
      case 'completed': return 'Fertig';
      case 'failed': return 'Fehlgeschlagen';
      default: return status;
    }
  };

  const examplePrompts = [
    'A cinematic shot of a cat walking on the beach at sunset, soft ocean waves, warm golden lighting, realistic motion',
    'Eine Drohnenaufnahme über eine futuristische Stadt bei Nacht, Neonlichter, fliegende Autos, Cyberpunk-Ästhetik',
    'Zeitrafferaufnahme einer Blume die aufblüht, Makro-Aufnahme, weiches natürliches Licht',
    'Ein Astronaut schwebt durch eine Raumstation, Schwerelosigkeit, filmische Beleuchtung',
  ];

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/20 rounded-full px-4 py-1.5 mb-3">
              <Play className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-300">KI-Videogenerierung</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Videos erstellen</h2>
            <p className="text-sm text-slate-400 mt-1">Asynchrone Generierung mit agnes-video-v2.0</p>
          </div>

          {/* Config */}
          <div className="bg-[#1a1a2e] border border-[#2d2d52] rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Auflösung</label>
                <select
                  value={`${width}x${height}`}
                  onChange={e => {
                    const [w, h] = e.target.value.split('x').map(Number);
                    setWidth(w);
                    setHeight(h);
                  }}
                  className="w-full bg-[#0f0f1a] border border-[#2d2d52] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  {resolutions.map(r => (
                    <option key={`${r.w}x${r.h}`} value={`${r.w}x${r.h}`}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Dauer (~{duration}s)
                </label>
                <div className="flex gap-1.5">
                  {durationPresets.map(d => (
                    <button
                      key={d.frames}
                      onClick={() => setNumFrames(d.frames)}
                      className={`flex-1 py-2 text-xs rounded-lg transition-colors ${
                        numFrames === d.frames
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#0f0f1a] border border-[#2d2d52] text-slate-400 hover:text-white'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">FPS</label>
                <select
                  value={frameRate}
                  onChange={e => setFrameRate(parseInt(e.target.value))}
                  className="w-full bg-[#0f0f1a] border border-[#2d2d52] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value={16}>16 FPS</option>
                  <option value={24}>24 FPS (Kino)</option>
                  <option value={30}>30 FPS</option>
                  <option value={60}>60 FPS</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Video-Prompt</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    createVideoTask();
                  }
                }}
                rows={3}
                placeholder="Beschreibe das Video, das du generieren möchtest..."
                className="w-full bg-[#0f0f1a] border border-[#2d2d52] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 resize-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {examplePrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(p)}
                  className="text-xs bg-[#242442] hover:bg-[#2d2d52] border border-[#2d2d52] rounded-lg px-2.5 py-1.5 text-slate-400 hover:text-slate-200 transition-colors truncate max-w-[280px]"
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={createVideoTask}
              disabled={!prompt.trim() || loading}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Task wird erstellt...
                </>
              ) : (
                <>
                  <Video className="w-5 h-5" />
                  Video generieren
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

          {/* Task List */}
          {tasks.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300">Video-Aufgaben ({tasks.length})</h3>
              {tasks.map(task => (
                <div
                  key={task.videoId}
                  className="bg-[#1a1a2e] border border-[#2d2d52] rounded-2xl overflow-hidden"
                >
                  {task.status === 'completed' && task.videoUrl && (
                    <div className="bg-black">
                      <video
                        controls
                        className="w-full max-h-[500px]"
                        src={task.videoUrl}
                      >
                        Dein Browser unterstützt das Video-Element nicht.
                      </video>
                    </div>
                  )}

                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-slate-300 flex-1">{task.prompt}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {getStatusIcon(task.status)}
                        <span className={`text-xs font-medium ${
                          task.status === 'completed' ? 'text-green-400' :
                          task.status === 'failed' ? 'text-red-400' :
                          task.status === 'in_progress' ? 'text-blue-400' : 'text-yellow-400'
                        }`}>
                          {getStatusText(task.status)}
                        </span>
                      </div>
                    </div>

                    {(task.status === 'queued' || task.status === 'in_progress') && (
                      <div className="space-y-1">
                        <div className="w-full bg-[#0f0f1a] rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full h-2 transition-all duration-500"
                            style={{ width: `${Math.max(task.progress, 5)}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500">{task.progress}% – Video wird generiert, bitte warten...</p>
                      </div>
                    )}

                    {task.status === 'failed' && task.error && (
                      <p className="text-xs text-red-400">{task.error}</p>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">agnes-video-v2.0</span>
                      <span className="text-xs text-slate-500">ID: {task.videoId?.slice(0, 20)}...</span>
                      {task.status === 'completed' && task.videoUrl && (
                        <a
                          href={task.videoUrl}
                          target="_blank"
                          rel="noopener"
                          download
                          className="ml-auto inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tasks.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <Video className="w-10 h-10 text-blue-400" />
              </div>
              <p className="text-slate-400 text-sm">Beschreibe ein Video und starte die Generierung</p>
              <p className="text-slate-500 text-xs mt-1">Videos werden asynchron generiert – du siehst den Fortschritt hier</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
