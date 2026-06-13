"use client";

import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";

interface EventGroupConflictModalProps {
  open: boolean;
  /** Event's current group name */
  eventGroupName: string;
  /** Contribution's group name — required for single mode "change event" option */
  contribGroupName?: string;
  /** "single": one contribution conflicts; "batch": multiple contributions */
  mode: "single" | "batch";
  conflictingCount: number;
  compatibleCount: number;
  /** Single mode: change event's categoryId to match the contribution's group */
  onChangeEvent?: () => Promise<void>;
  /** Single & batch: overwrite contribution(s)' groups with event's group and add to event */
  onOverwriteContrib: () => Promise<void>;
  /** Batch only: add only compatible contributions, skip conflicting */
  onAddCompatibleOnly?: () => void;
  onCancel: () => void;
}

export function EventGroupConflictModal({
  open,
  eventGroupName,
  contribGroupName,
  mode,
  conflictingCount,
  compatibleCount,
  onChangeEvent,
  onOverwriteContrib,
  onAddCompatibleOnly,
  onCancel,
}: EventGroupConflictModalProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    await fn();
    setBusy(false);
  }

  if (!open) return null;

  const isSingle = mode === "single";

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
            <h2 className="text-sm font-semibold text-ink">{t.eventGroupConflict.title}</h2>
            <p className="mt-1 text-xs text-ink-dim leading-relaxed">
              {isSingle
                ? t.eventGroupConflict.singleDesc(contribGroupName ?? "", eventGroupName)
                : (
                  <>
                    {t.eventGroupConflict.batchConflicting(conflictingCount, eventGroupName)}
                    {compatibleCount > 0 && t.eventGroupConflict.batchCompatible(compatibleCount)}
                  </>
                )
              }
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2">

          {/* Single mode: change event's group */}
          {isSingle && onChangeEvent && contribGroupName && (
            <button
              onClick={() => run(onChangeEvent)}
              disabled={busy}
              className="w-full rounded-xl border border-rim bg-surface-high px-4 py-3 text-left hover:bg-surface-high/80 disabled:opacity-50"
            >
              <p className="text-sm font-semibold text-ink">
                {t.eventGroupConflict.changeEventTitle(contribGroupName)}
              </p>
              <p className="mt-0.5 text-xs text-ink-dim">
                {t.eventGroupConflict.changeEventDesc}
              </p>
            </button>
          )}

          {/* Single & batch: overwrite contribution(s)' groups with event's group */}
          <button
            onClick={() => run(onOverwriteContrib)}
            disabled={busy}
            className="w-full rounded-xl border border-gold bg-gold-dim px-4 py-3 text-left hover:bg-gold/20 disabled:opacity-50"
          >
            <p className="text-sm font-semibold text-gold">
              {t.eventGroupConflict.overwriteTitle(isSingle ? 1 : conflictingCount, eventGroupName)}
            </p>
            <p className="mt-0.5 text-xs text-ink-dim">
              {t.eventGroupConflict.overwriteDesc(isSingle ? 1 : conflictingCount, eventGroupName)}
            </p>
          </button>

          {/* Batch only: add compatible only */}
          {!isSingle && onAddCompatibleOnly && (
            <button
              onClick={onAddCompatibleOnly}
              disabled={busy || compatibleCount === 0}
              className="w-full rounded-xl border border-rim px-4 py-3 text-left hover:bg-surface-high disabled:opacity-40"
            >
              <p className="text-sm font-semibold text-ink">
                {t.eventGroupConflict.addCompatibleTitle(compatibleCount)}
              </p>
              <p className="mt-0.5 text-xs text-ink-dim">
                {t.eventGroupConflict.addCompatibleDesc(conflictingCount)}
              </p>
            </button>
          )}
        </div>

        <button
          onClick={onCancel}
          disabled={busy}
          className="w-full rounded-xl border border-rim py-2 text-sm text-ink-dim hover:bg-surface-high"
        >
          {t.eventGroupConflict.cancelBtn}
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
