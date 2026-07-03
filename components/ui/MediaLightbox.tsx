"use client";

import { useEffect } from "react";

export interface LightboxItem {
  url: string;
  type: "photo" | "video";
}

interface MediaLightboxProps {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export function MediaLightbox({ items, index, onClose, onIndexChange }: MediaLightboxProps) {
  const item = items[index];
  const hasMultiple = items.length > 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (hasMultiple && e.key === "ArrowLeft") onIndexChange((index - 1 + items.length) % items.length);
      else if (hasMultiple && e.key === "ArrowRight") onIndexChange((index + 1) % items.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, items.length, hasMultiple, onClose, onIndexChange]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full p-2 text-white/80 hover:text-white hover:bg-white/10"
        aria-label="Close"
      >
        <CloseIcon />
      </button>

      {hasMultiple && (
        <span className="absolute top-4 left-4 z-10 text-xs font-medium text-white/70">
          {index + 1} / {items.length}
        </span>
      )}

      {hasMultiple && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onIndexChange((index - 1 + items.length) % items.length); }}
            className="absolute left-1 sm:left-4 z-10 rounded-full p-2 text-white/80 hover:text-white hover:bg-white/10"
            aria-label="Previous"
          >
            <ChevronLeftIcon />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onIndexChange((index + 1) % items.length); }}
            className="absolute right-1 sm:right-4 z-10 rounded-full p-2 text-white/80 hover:text-white hover:bg-white/10"
            aria-label="Next"
          >
            <ChevronRightIcon />
          </button>
        </>
      )}

      <div className="relative max-w-full max-h-full px-4 py-14 sm:px-16" onClick={(e) => e.stopPropagation()}>
        {item.type === "photo" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={item.url} src={item.url} alt="" className="max-w-full max-h-[85vh] object-contain rounded" />
        ) : (
          <video key={item.url} src={item.url} controls autoPlay playsInline className="max-w-full max-h-[85vh] rounded" />
        )}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
