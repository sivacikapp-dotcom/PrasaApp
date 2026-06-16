'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface Props {
  source: string;
  fileName: string;
  onSave: (file: File) => void;
  onClose: () => void;
}

let _ffmpeg: FFmpeg | null = null;
let _loading: Promise<FFmpeg> | null = null;

function loadFFmpeg(): Promise<FFmpeg> {
  if (_ffmpeg?.loaded) return Promise.resolve(_ffmpeg);
  if (_loading) return _loading;
  _loading = (async () => {
    const ffmpeg = new FFmpeg();
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
      toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
    ]);
    await ffmpeg.load({ coreURL, wasmURL });
    _ffmpeg = ffmpeg;
    return ffmpeg;
  })().catch((e: unknown) => {
    _loading = null; // allow retry on failure
    throw e;
  });
  return _loading;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function VideoEditor({ source, fileName, onSave, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewStopRef = useRef<(() => void) | null>(null);

  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [loadPct, setLoadPct] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [trimPct, setTrimPct] = useState(0);
  const [trimError, setTrimError] = useState<string | null>(null);

  // Start loading FFmpeg immediately — it'll be ready when user finishes setting trim
  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(() => setLoadPct((p) => Math.min(p + 3, 88)), 700);

    loadFFmpeg()
      .then(() => {
        clearInterval(interval);
        if (!cancelled) { setLoadPct(100); setFfmpegReady(true); }
      })
      .catch((e: unknown) => {
        clearInterval(interval);
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Chyba načítania FFmpeg';
          setLoadError(msg);
        }
      });

    return () => {
      cancelled = true;
      clearInterval(interval);
      previewStopRef.current?.();
    };
  }, []);

  const onMetadata = useCallback(() => {
    const d = videoRef.current?.duration ?? 0;
    if (isFinite(d) && d > 0) { setDuration(d); setEndTime(d); }
  }, []);

  const previewSelection = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    previewStopRef.current?.();
    v.currentTime = startTime;
    v.play().catch(() => {});
    const check = () => {
      if (v.currentTime >= endTime) { v.pause(); v.removeEventListener('timeupdate', check); previewStopRef.current = null; }
    };
    v.addEventListener('timeupdate', check);
    previewStopRef.current = () => { v.pause(); v.removeEventListener('timeupdate', check); };
  }, [startTime, endTime]);

  const handleTrim = useCallback(async () => {
    if (!ffmpegReady || processing) return;
    setProcessing(true);
    setTrimPct(0);
    setTrimError(null);

    try {
      const ffmpeg = await loadFFmpeg();
      ffmpeg.on('progress', ({ progress }) => setTrimPct(Math.round(progress * 100)));

      const ext = fileName.split('.').pop() ?? 'mp4';
      const inputName = `input.${ext}`;
      const outputName = `output.${ext}`;

      await ffmpeg.writeFile(inputName, await fetchFile(source));
      await ffmpeg.exec([
        '-i', inputName,
        '-ss', String(startTime),
        '-to', String(endTime),
        '-c', 'copy',
        '-avoid_negative_ts', '1',
        outputName,
      ]);

      const data = await ffmpeg.readFile(outputName) as Uint8Array;
      const mime = ext === 'webm' ? 'video/webm' : 'video/mp4';
      const blob = new Blob([data.buffer as ArrayBuffer], { type: mime });
      const base = fileName.replace(/\.[^/.]+$/, '');
      const file = new File([blob], `${base}_trimmed.${ext}`, { type: mime });

      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      onSave(file);
    } catch (e: unknown) {
      setTrimError(e instanceof Error ? e.message : 'Chyba pri strihu videa');
      setProcessing(false);
    }
  }, [ffmpegReady, processing, source, fileName, startTime, endTime, onSave]);

  const selDuration = endTime - startTime;
  const canTrim = ffmpegReady && !processing && selDuration >= 0.5 && duration > 0;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button type="button" onClick={onClose} disabled={processing}
          className="text-white/60 hover:text-white text-sm py-1 px-2 disabled:opacity-40">
          Zrušiť
        </button>
        <span className="text-white text-sm font-medium">Strih videa</span>
        <button type="button" onClick={handleTrim} disabled={!canTrim}
          className="text-[#D4A843] font-semibold text-sm py-1 px-2 disabled:opacity-40">
          {processing ? 'Strihám…' : 'Orezať'}
        </button>
      </div>

      {/* Video player */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-black overflow-hidden">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={source}
          onLoadedMetadata={onMetadata}
          controls
          playsInline
          className="max-h-full max-w-full"
        />
      </div>

      {/* Bottom toolbar */}
      <div className="bg-zinc-900 shrink-0 px-4 pt-3 pb-6 space-y-3">

        {/* FFmpeg loading */}
        {!ffmpegReady && !loadError && (
          <div className="space-y-1.5">
            <p className="text-white/50 text-xs text-center">Načítavam editor… {loadPct}%</p>
            <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
              <div className="h-full bg-[#D4A843] transition-all duration-500" style={{ width: `${loadPct}%` }} />
            </div>
          </div>
        )}

        {loadError && (
          <p className="text-red-400 text-xs text-center">{loadError}</p>
        )}

        {/* Trim progress */}
        {processing && (
          <div className="space-y-1.5">
            <p className="text-white/50 text-xs text-center">
              {trimPct > 0 ? `Strihám… ${trimPct}%` : 'Spracovávam…'}
            </p>
            <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#D4A843] transition-all"
                style={{ width: trimPct > 0 ? `${trimPct}%` : '100%' }}
              />
            </div>
          </div>
        )}

        {trimError && (
          <p className="text-red-400 text-xs text-center">{trimError}</p>
        )}

        {/* Timeline + sliders — show when video loaded */}
        {!processing && duration > 0 && (
          <>
            {/* Visual range indicator */}
            <div className="relative h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="absolute top-0 h-full bg-[#D4A843]/60 rounded-full"
                style={{
                  left: `${(startTime / duration) * 100}%`,
                  width: `${(selDuration / duration) * 100}%`,
                }}
              />
            </div>

            {/* Start slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-white/50">Začiatok</span>
                <span className="text-[#D4A843] font-medium tabular-nums">{fmt(startTime)}</span>
              </div>
              <input
                type="range" min={0} max={duration} step={0.1} value={startTime}
                onChange={(e) => {
                  const v = Math.min(Number(e.target.value), endTime - 0.5);
                  setStartTime(v);
                  if (videoRef.current) videoRef.current.currentTime = v;
                }}
                className="w-full accent-[#D4A843]"
              />
            </div>

            {/* End slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-white/50">Koniec</span>
                <span className="text-[#D4A843] font-medium tabular-nums">{fmt(endTime)}</span>
              </div>
              <input
                type="range" min={0} max={duration} step={0.1} value={endTime}
                onChange={(e) => {
                  const v = Math.max(Number(e.target.value), startTime + 0.5);
                  setEndTime(v);
                  if (videoRef.current) videoRef.current.currentTime = v;
                }}
                className="w-full accent-[#D4A843]"
              />
            </div>

            {/* Summary + preview */}
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-xs tabular-nums">
                {fmt(startTime)} → {fmt(endTime)} · <span className="text-white/60">{fmt(selDuration)}</span>
              </span>
              <button type="button" onClick={previewSelection}
                className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-white/60 hover:text-white hover:border-zinc-500 transition-colors">
                ▶ Náhľad
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
