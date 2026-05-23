"use client";

import { useEffect, useState } from "react";
import { getEvents } from "@/lib/eventService";
import type { ChronicleEvent } from "@/types/contribution";

interface EventPickerModalProps {
  open: boolean;
  onConfirm: (event: ChronicleEvent) => Promise<void>;
  onClose: () => void;
}

export function EventPickerModal({ open, onConfirm, onClose }: EventPickerModalProps) {
  const [events, setEvents] = useState<ChronicleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getEvents().then((e) => { setEvents(e); setLoading(false); });
  }, [open]);

  async function handleSelect(event: ChronicleEvent) {
    setSaving(event.id);
    await onConfirm(event);
    setSaving(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-surface border border-rim shadow-2xl flex flex-col max-h-[70vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-rim shrink-0">
          <h2 className="text-sm font-semibold text-ink">Zaradiť do udalosti</h2>
          <button onClick={onClose} className="p-1 text-ink-subtle hover:text-ink">
            <XIcon />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="py-10 text-center text-sm text-ink-subtle">Načítavam…</div>
          ) : events.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-subtle">Žiadne udalosti.</div>
          ) : (
            events.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => handleSelect(ev)}
                disabled={saving !== null}
                className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-rim last:border-0 hover:bg-surface-high disabled:opacity-50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-dim text-gold">
                  <CalendarIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{ev.title}</p>
                  <p className="text-xs text-ink-subtle">
                    {ev.contributionIds.length} príspevkov
                    {ev.locationName ? ` · ${ev.locationName}` : ""}
                  </p>
                </div>
                {saving === ev.id && (
                  <span className="text-xs text-ink-subtle shrink-0">Pridávam…</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-rim shrink-0">
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-rim py-2.5 text-sm font-medium text-ink-dim hover:bg-surface-high"
          >
            Zrušiť
          </button>
        </div>
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
