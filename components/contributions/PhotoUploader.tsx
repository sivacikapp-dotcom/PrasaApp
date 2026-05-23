"use client";

import { useRef } from "react";

export interface PhotoFile {
  file: File;
  previewUrl: string;
}

interface PhotoUploaderProps {
  photos: PhotoFile[];
  existingUrls?: string[];
  onChange: (photos: PhotoFile[]) => void;
  onDeleteExisting?: (url: string) => void;
  maxCount?: number;
}

export function PhotoUploader({ photos, existingUrls = [], onChange, onDeleteExisting, maxCount = 10 }: PhotoUploaderProps) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const total = existingUrls.length + photos.length;
  const canAdd = total < maxCount;

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const newPhotos: PhotoFile[] = Array.from(files)
      .slice(0, maxCount - total)
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    onChange([...photos, ...newPhotos]);
  }

  function removeNew(index: number) {
    URL.revokeObjectURL(photos[index].previewUrl);
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {(existingUrls.length > 0 || photos.length > 0) && (
        <div className="grid grid-cols-3 gap-2">
          {existingUrls.map((url) => (
            <div key={url} className="relative aspect-square rounded-xl overflow-hidden bg-surface-high">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              {onDeleteExisting && (
                <button type="button" onClick={() => onDeleteExisting(url)}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-ink hover:bg-black/80"
                  aria-label="Odstrániť">
                  <XIcon />
                </button>
              )}
            </div>
          ))}
          {photos.map((p, i) => (
            <div key={p.previewUrl} className="relative aspect-square rounded-xl overflow-hidden bg-surface-high">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <button type="button" onClick={() => removeNew(i)}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-ink hover:bg-black/80"
                aria-label="Odstrániť">
                <XIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => cameraRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border border-rim bg-surface px-3 py-2 text-sm text-ink-dim hover:bg-surface-high hover:text-ink">
            <CameraIcon /> Odfotiť
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border border-rim bg-surface px-3 py-2 text-sm text-ink-dim hover:bg-surface-high hover:text-ink">
            <PhotoIcon /> Z galérie
          </button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => handleFiles(e.target.files)} />
          <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => handleFiles(e.target.files)} />
        </div>
      )}
      {!canAdd && <p className="text-xs text-ink-subtle">Dosiahnutý maximálny počet fotografií ({maxCount})</p>}
    </div>
  );
}

function XIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 4.586L2.707 1.293 1.293 2.707 4.586 6 1.293 9.293l1.414 1.414L6 7.414l3.293 3.293 1.414-1.414L7.414 6l3.293-3.293L9.293 1.293z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
