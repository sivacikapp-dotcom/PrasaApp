"use client";

import { useEffect, useRef, useState } from "react";
import { getEvents } from "@/lib/eventService";
import type { Group, ChronicleEvent } from "@/types/contribution";

interface EventPickerModalProps {
  open: boolean;
  onConfirm: (event: ChronicleEvent) => Promise<void>;
  onClose: () => void;
  categories?: Group[];
  onCreateAndAssign?: (title: string, categoryId: string | null) => Promise<void>;
}

export function EventPickerModal({ open, onConfirm, onClose, categories, onCreateAndAssign }: EventPickerModalProps) {
  const [events, setEvents] = useState<ChronicleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [view, setView] = useState<"list" | "create">("list");
  const [newTitle, setNewTitle] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setView("list");
    setNewTitle("");
    setNewCategoryId(null);
    setLoading(true);
    getEvents().then((e) => { setEvents(e); setLoading(false); });
  }, [open]);

  function openCreate() {
    setNewTitle("");
    setNewCategoryId(categories?.[0]?.id ?? null);
    setView("create");
    setTimeout(() => titleRef.current?.focus(), 50);
  }

  async function handleSelect(event: ChronicleEvent) {
    setSaving(event.id);
    await onConfirm(event);
    setSaving(null);
    onClose();
  }

  async function handleCreate() {
    if (!onCreateAndAssign || !newTitle.trim()) return;
    setCreating(true);
    await onCreateAndAssign(newTitle.trim(), newCategoryId);
    setCreating(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-surface border border-rim shadow-2xl flex flex-col max-h-[70vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-rim shrink-0">
          <div className="flex items-center gap-2">
            {view === "create" && (
              <button onClick={() => setView("list")} className="p-1 text-ink-subtle hover:text-ink">
                <BackIcon />
              </button>
            )}
            <h2 className="text-sm font-semibold text-ink">
              {view === "list" ? "Zaradiť do udalosti" : "Vytvoriť novú udalosť"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-ink-subtle hover:text-ink">
            <XIcon />
          </button>
        </div>

        {view === "list" ? (
          <>
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
            <div className="px-4 py-3 border-t border-rim shrink-0 flex flex-col gap-2">
              {onCreateAndAssign && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="w-full rounded-xl border border-gold/40 bg-gold-dim py-2.5 text-sm font-medium text-gold hover:bg-gold/20"
                >
                  + Vytvoriť novú udalosť
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full rounded-xl border border-rim py-2.5 text-sm font-medium text-ink-dim hover:bg-surface-high"
              >
                Zrušiť
              </button>
            </div>
          </>
        ) : (
          /* Create form */
          <>
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-dim">
                  Názov udalosti <span className="text-danger">*</span>
                </label>
                <input
                  ref={titleRef}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) handleCreate(); }}
                  placeholder="napr. Letný tábor 2025"
                  className="w-full rounded-xl border border-rim bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>

              {categories && categories.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-dim">Skupina</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setNewCategoryId(newCategoryId === cat.id ? null : cat.id)}
                        className={`rounded-full px-3 py-1 text-sm font-medium transition-colors border ${
                          newCategoryId === cat.id
                            ? "border-transparent text-gold-text"
                            : "bg-transparent text-ink-dim border-rim hover:border-rim-strong"
                        }`}
                        style={newCategoryId === cat.id ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-rim shrink-0 flex gap-2">
              <button
                type="button"
                onClick={() => setView("list")}
                className="flex-1 rounded-xl border border-rim py-2.5 text-sm font-medium text-ink-dim hover:bg-surface-high"
              >
                Späť
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newTitle.trim() || creating}
                className="flex-1 rounded-xl bg-gold py-2.5 text-sm font-medium text-gold-text hover:bg-gold/90 disabled:opacity-50 disabled:pointer-events-none"
              >
                {creating ? "Vytvárám…" : "Vytvoriť a zaradiť"}
              </button>
            </div>
          </>
        )}
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

function BackIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M19 12H5M12 5l-7 7 7 7" />
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
