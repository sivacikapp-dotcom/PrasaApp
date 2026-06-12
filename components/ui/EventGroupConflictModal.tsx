"use client";

import { useState } from "react";

interface EventGroupConflictModalProps {
  open: boolean;
  eventGroupName: string;
  /** "single": one contribution conflicts; "batch": multiple contributions */
  mode: "single" | "batch";
  conflictingCount: number;
  compatibleCount: number;
  /** A: align conflicting contributions' groups to event group, then add all */
  onAlign: () => Promise<void>;
  /** B (single): add contribution to event without changing its group */
  onProceedAnyway?: () => void;
  /** B (batch): add only compatible contributions */
  onAddCompatibleOnly?: () => void;
  onCancel: () => void;
}

export function EventGroupConflictModal({
  open,
  eventGroupName,
  mode,
  conflictingCount,
  compatibleCount,
  onAlign,
  onProceedAnyway,
  onAddCompatibleOnly,
  onCancel,
}: EventGroupConflictModalProps) {
  const [busy, setBusy] = useState(false);

  async function handleAlign() {
    setBusy(true);
    await onAlign();
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
            <h2 className="text-sm font-semibold text-ink">Konflikt skupiny</h2>
            <p className="mt-1 text-xs text-ink-dim leading-relaxed">
              {isSingle ? (
                <>
                  Príspevok je zaradený do inej skupiny ako táto udalosť{" "}
                  <strong className="text-ink">({eventGroupName})</strong>.
                </>
              ) : (
                <>
                  {conflictingCount}{" "}
                  {conflictingCount === 1 ? "príspevok má" : conflictingCount < 5 ? "príspevky majú" : "príspevkov má"}{" "}
                  inú skupinu ako táto udalosť{" "}
                  <strong className="text-ink">({eventGroupName})</strong>.
                  {compatibleCount > 0 && (
                    <> {compatibleCount}{" "}
                    {compatibleCount === 1 ? "príspevok je kompatibilný" : "príspevkov je kompatibilných"}.</>
                  )}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2">
          <button
            onClick={handleAlign}
            disabled={busy}
            className="w-full rounded-xl border border-gold bg-gold-dim px-4 py-3 text-left hover:bg-gold/20 disabled:opacity-50"
          >
            <p className="text-sm font-semibold text-gold">
              {isSingle ? "Zaradiť príspevok do skupiny" : "Zaradiť všetky do skupiny"}{" "}
              <span className="font-normal">„{eventGroupName}"</span>
            </p>
            <p className="mt-0.5 text-xs text-ink-dim">
              {isSingle
                ? "Skupina príspevku sa zmení a príspevok sa pridá do udalosti."
                : `Skupina ${conflictingCount === 1 ? "príspevku" : `${conflictingCount} príspevkov`} sa zmení na „${eventGroupName}" a všetky sa pridajú do udalosti.`}
            </p>
          </button>

          {isSingle && onProceedAnyway && (
            <button
              onClick={onProceedAnyway}
              disabled={busy}
              className="w-full rounded-xl border border-rim px-4 py-3 text-left hover:bg-surface-high disabled:opacity-40"
            >
              <p className="text-sm font-semibold text-ink">Pokračovať bez zmeny skupín</p>
              <p className="mt-0.5 text-xs text-ink-dim">
                Príspevok sa pridá do udalosti, jeho skupina ostane nezmenená.
              </p>
            </button>
          )}

          {!isSingle && onAddCompatibleOnly && (
            <button
              onClick={onAddCompatibleOnly}
              disabled={busy || compatibleCount === 0}
              className="w-full rounded-xl border border-rim px-4 py-3 text-left hover:bg-surface-high disabled:opacity-40"
            >
              <p className="text-sm font-semibold text-ink">
                Pridať iba kompatibilné{compatibleCount > 0 ? ` (${compatibleCount})` : ""}
              </p>
              <p className="mt-0.5 text-xs text-ink-dim">
                {compatibleCount > 0
                  ? `${conflictingCount} ${conflictingCount === 1 ? "príspevok" : "príspevkov"} s inou skupinou sa nepridá.`
                  : "Žiadne kompatibilné príspevky na pridanie."}
              </p>
            </button>
          )}
        </div>

        <button
          onClick={onCancel}
          disabled={busy}
          className="w-full rounded-xl border border-rim py-2 text-sm text-ink-dim hover:bg-surface-high"
        >
          Zrušiť
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
