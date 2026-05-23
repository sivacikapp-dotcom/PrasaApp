"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { getAllContributions } from "@/lib/contributionService";
import type { Contribution } from "@/types/contribution";

interface ContributionPickerModalProps {
  open: boolean;
  title: string;
  alreadyIncluded: string[];
  allowedCategoryIds?: string[];
  onConfirm: (ids: string[], selected: Contribution[]) => Promise<void>;
  onClose: () => void;
}

export function ContributionPickerModal({
  open,
  title,
  alreadyIncluded,
  allowedCategoryIds,
  onConfirm,
  onClose,
}: ContributionPickerModalProps) {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setLoading(true);
    getAllContributions().then((all) => {
      setContributions(
        all.filter((c) => {
          if (c.status !== "processed") return false;
          if (alreadyIncluded.includes(c.id)) return false;
          if (allowedCategoryIds && !c.categories.some((id) => allowedCategoryIds.includes(id))) return false;
          return true;
        })
      );
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size === 0) return;
    setSaving(true);
    const selectedIds = Array.from(selected);
    const selectedContribs = contributions.filter((c) => selected.has(c.id));
    await onConfirm(selectedIds, selectedContribs);
    setSaving(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-surface border border-rim shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-rim shrink-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="p-1 text-ink-subtle hover:text-ink">
            <XIcon />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="py-10 text-center text-sm text-ink-subtle">Načítavam…</div>
          ) : contributions.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-subtle">
              Žiadne spracované príspevky na pridanie.
            </div>
          ) : (
            contributions.map((c) => {
              const checked = selected.has(c.id);
              const date = c.verifiedEventDate ?? c.eventDate;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-rim last:border-0 transition-colors ${
                    checked ? "bg-gold-dim" : "hover:bg-surface-high"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked ? "border-gold bg-gold" : "border-rim-strong bg-surface"
                    }`}
                  >
                    {checked && (
                      <svg className="h-2.5 w-2.5 text-gold-text" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gold">
                      {format(date, "d. MMMM yyyy", { locale: sk })}
                      <span className="ml-2 font-normal text-ink-subtle">{c.contributorName}</span>
                    </p>
                    {c.texts[0] && (
                      <p className="mt-0.5 text-xs text-ink line-clamp-2">{c.texts[0]}</p>
                    )}
                    {!c.texts[0] && c.photoUrls.length > 0 && (
                      <p className="mt-0.5 text-xs text-ink-subtle">{c.photoUrls.length} fotograf{c.photoUrls.length === 1 ? "ia" : "ie"}</p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-rim shrink-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-rim py-2.5 text-sm font-medium text-ink-dim hover:bg-surface-high"
          >
            Zrušiť
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0 || saving}
            className="flex-1 rounded-xl bg-gold py-2.5 text-sm font-semibold text-gold-text disabled:opacity-40"
          >
            {saving ? "Pridávam…" : `Pridať${selected.size > 0 ? ` (${selected.size})` : ""}`}
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
