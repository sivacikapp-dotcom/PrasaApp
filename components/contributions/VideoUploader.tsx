"use client";

import { useRef } from "react";

export interface VideoFile {
  file: File;
  previewUrl: string;
}

interface VideoUploaderProps {
  videos: VideoFile[];
  onChange: (videos: VideoFile[]) => void;
  maxCount?: number;
}

export function VideoUploader({ videos, onChange, maxCount = 3 }: VideoUploaderProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const canAdd = videos.length < maxCount;

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const newVideos: VideoFile[] = Array.from(files)
      .slice(0, maxCount - videos.length)
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    onChange([...videos, ...newVideos]);
  }

  function remove(index: number) {
    URL.revokeObjectURL(videos[index].previewUrl);
    onChange(videos.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {videos.map((v, i) => (
        <div key={v.previewUrl} className="rounded-xl border border-rim bg-surface overflow-hidden">
          <video
            src={v.previewUrl}
            controls
            playsInline
            className="w-full max-h-48 bg-black object-contain"
          />
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="flex-1 truncate text-xs text-ink-subtle">{v.file.name}</span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 text-ink-subtle hover:text-danger"
              aria-label="Odstrániť video"
            >
              <TrashSmallIcon />
            </button>
          </div>
        </div>
      ))}

      {canAdd && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border border-rim bg-surface px-3 py-2 text-sm text-ink-dim hover:bg-surface-high hover:text-ink"
          >
            <VideoIcon /> Nahrať video
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border border-rim bg-surface px-3 py-2 text-sm text-ink-dim hover:bg-surface-high hover:text-ink"
          >
            <FilmIcon /> Z galérie
          </button>
          <input
            ref={cameraRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}
      {!canAdd && (
        <p className="text-xs text-ink-subtle">Dosiahnutý maximálny počet videí ({maxCount})</p>
      )}
    </div>
  );
}

function TrashSmallIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="17" x2="22" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
    </svg>
  );
}
