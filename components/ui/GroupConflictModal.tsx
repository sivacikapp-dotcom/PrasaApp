"use client";

import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";

interface GroupConflictModalProps {
  open: boolean;
  /** Name of the group the group/event uses */
  dominantCategoryName: string;
  /** How many contributions match */
  compatibleCount: number;
  /** How many contributions conflict */
  conflictingCount: number;
  /** Option A: change the conflicting contributions' group to match the group/event */
  onChangeCategory: () => Promise<void>;
  /** Option B: skip conflicting contributions, add only the compatible ones */
  onSkipConflicting: () => void;
  onCancel: () => void;
}

export function GroupConflictModal({
  open,
  dominantCategoryName,
  compatibleCount,
  conflictingCount,
  onChangeCategory,
  onSkipConflicting,
  onCancel,
}: GroupConflictModalProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function handleChangeCategory() {
    setBusy(true);
    await onChangeCategory();
    setBusy(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-surface border border-rim shadow-2xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning">
            <WarningIcon />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">{t.groupConflict.title}</h2>
            <p className="mt-1 text-xs text-ink-dim leading-relaxed">
              {t.groupConflict.conflictingHave(conflictingCount)}{" "}
              <strong className="text-ink">({dominantCategoryName})</strong>.
              {compatibleCount > 0 && t.groupConflict.compatibleInfo(compatibleCount)}
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2">
          <button
            onClick={handleChangeCategory}
            disabled={busy}
            className="w-full rounded-xl border border-gold bg-gold-dim px-4 py-3 text-left hover:bg-gold/20 disabled:opacity-50"
          >
            <p className="text-sm font-semibold text-gold">
              {t.groupConflict.optionATitle}
            </p>
            <p className="mt-0.5 text-xs text-ink-dim">
              {t.groupConflict.optionADesc(conflictingCount, dominantCategoryName)}
            </p>
          </button>

          <button
            onClick={onSkipConflicting}
            disabled={busy || compatibleCount === 0}
            className="w-full rounded-xl border border-rim px-4 py-3 text-left hover:bg-surface-high disabled:opacity-40"
          >
            <p className="text-sm font-semibold text-ink">
              {t.groupConflict.optionBTitle}
            </p>
            <p className="mt-0.5 text-xs text-ink-dim">
              {t.groupConflict.optionBDesc(compatibleCount)}
            </p>
          </button>
        </div>

        <button
          onClick={onCancel}
          disabled={busy}
          className="w-full rounded-xl border border-rim py-2 text-sm text-ink-dim hover:bg-surface-high"
        >
          {t.groupConflict.cancelBtn}
        </button>
      </div>
    </div>
  );
}

function WarningIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
