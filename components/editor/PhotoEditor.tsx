'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface Props {
  source: string;
  fileName: string;
  onSave: (file: File) => void;
  onClose: () => void;
}

type Tab = 'adjust' | 'crop';

export function PhotoEditor({ source, fileName, onSave, onClose }: Props) {
  const [workingUrl, setWorkingUrl] = useState(source);
  const workingUrlRef = useRef(source);
  const [tab, setTab] = useState<Tab>('adjust');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Revoke intermediate blob URLs created during rotation when editor closes
  useEffect(() => {
    return () => {
      const url = workingUrlRef.current;
      if (url !== source && url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [source]);

  const rotate = useCallback((deg: 90 | -90) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const prev = workingUrlRef.current;
        const next = URL.createObjectURL(blob);
        workingUrlRef.current = next;
        setWorkingUrl(next);
        setCrop(undefined);
        setCompletedCrop(undefined);
        if (prev !== source && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      }, 'image/jpeg', 0.95);
    };
    img.src = workingUrlRef.current;
  }, [source]);

  const handleSave = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    setSaving(true);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    if (completedCrop?.width && completedCrop?.height) {
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;
      canvas.width = Math.round(completedCrop.width * scaleX);
      canvas.height = Math.round(completedCrop.height * scaleY);
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      ctx.drawImage(
        img,
        completedCrop.x * scaleX, completedCrop.y * scaleY,
        completedCrop.width * scaleX, completedCrop.height * scaleY,
        0, 0, canvas.width, canvas.height,
      );
    } else {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      ctx.drawImage(img, 0, 0);
    }

    canvas.toBlob((blob) => {
      if (!blob) { setSaving(false); return; }
      const base = fileName.replace(/\.[^/.]+$/, '');
      const file = new File([blob], `${base}_edited.jpg`, { type: 'image/jpeg' });
      onSave(file);
    }, 'image/jpeg', 0.92);
  }, [completedCrop, brightness, contrast, fileName, onSave]);

  const imgStyle: React.CSSProperties = {
    maxHeight: '100%',
    maxWidth: '100%',
    objectFit: 'contain',
    filter: `brightness(${brightness}%) contrast(${contrast}%)`,
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button type="button" onClick={onClose} className="text-white/60 hover:text-white text-sm py-1 px-2">
          Zrušiť
        </button>
        <span className="text-white text-sm font-medium">Upraviť foto</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-[#D4A843] font-semibold text-sm py-1 px-2 disabled:opacity-40"
        >
          {saving ? 'Ukladám…' : 'Použiť'}
        </button>
      </div>

      {/* Image area */}
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden px-2">
        {tab === 'crop' ? (
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            style={{ maxHeight: '100%', maxWidth: '100%', display: 'flex' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={imgRef} src={workingUrl} alt="" style={imgStyle} />
          </ReactCrop>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={imgRef} src={workingUrl} alt="" style={imgStyle} />
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="bg-zinc-900 shrink-0">
        <div className="flex border-b border-zinc-800">
          {(['adjust', 'crop'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t ? 'text-[#D4A843] border-b-2 border-[#D4A843]' : 'text-white/50'
              }`}
            >
              {t === 'adjust' ? 'Úpravy' : 'Orezať'}
            </button>
          ))}
        </div>

        <div className="px-4 pt-3 pb-6 space-y-4">
          {/* Rotate — always visible */}
          <div className="flex justify-center gap-10">
            <button
              type="button"
              onClick={() => rotate(-90)}
              className="flex flex-col items-center gap-1 text-white/70 hover:text-white active:text-[#D4A843] transition-colors"
            >
              <RotateLeftIcon />
              <span className="text-xs">Doľava</span>
            </button>
            <button
              type="button"
              onClick={() => rotate(90)}
              className="flex flex-col items-center gap-1 text-white/70 hover:text-white active:text-[#D4A843] transition-colors"
            >
              <RotateRightIcon />
              <span className="text-xs">Doprava</span>
            </button>
          </div>

          {tab === 'adjust' && (
            <div className="space-y-3">
              <SliderRow label="Jas" value={brightness} onChange={setBrightness} min={50} max={150} />
              <SliderRow label="Kontrast" value={contrast} onChange={setContrast} min={50} max={150} />
            </div>
          )}
          {tab === 'crop' && (
            <p className="text-white/40 text-xs text-center">
              Ťahaj na obrázku pre výber oblasti
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SliderRow({ label, value, onChange, min, max }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number;
}) {
  const display = value - 100;
  return (
    <div className="flex items-center gap-3">
      <span className="text-white/60 text-sm w-16 shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[#D4A843]"
      />
      <span className="text-white/40 text-xs w-8 text-right tabular-nums">
        {display > 0 ? `+${display}` : display}
      </span>
    </div>
  );
}

function RotateLeftIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function RotateRightIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}
