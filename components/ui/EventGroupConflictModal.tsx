"use client";

import { useState } from "react";

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
            <h2 className="text-sm font-semibold text-ink">Nesúlad skupín</h2>
            <p className="mt-1 text-xs text-ink-dim leading-relaxed">
              {isSingle ? (
                <>
                  Príspevok je v skupine{" "}
                  <strong className="text-ink">„{contribGroupName}"</strong>, no udalosť má skupinu{" "}
                  <strong className="text-ink">„{eventGroupName}"</strong>.
                  {" "}Vyberte, ako chcete nesúlad vyriešiť.
                </>
              ) : (
                <>
                  {conflictingCount}{" "}
                  {conflictingCount === 1 ? "príspevok má" : conflictingCount < 5 ? "príspevky majú" : "príspevkov má"}{" "}
                  inú skupinu ako udalosť{" "}
                  <strong className="text-ink">(„{eventGroupName}")</strong>.
                  {compatibleCount > 0 && (
                    <> {compatibleCount}{" "}
                    {compatibleCount === 1 ? "príspevok je kompatibilný" : compatibleCount < 5 ? "príspevky sú kompatibilné" : "príspevkov je kompatibilných"}.</>
                  )}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2">

          {/* Single mode: change event's group */}
          {isSingle && onChangeEvent && (
            <button
              onClick={() => run(onChangeEvent)}
              disabled={busy}
              className="w-full rounded-xl border border-rim bg-surface-high px-4 py-3 text-left hover:bg-surface-high/80 disabled:opacity-50"
            >
              <p className="text-sm font-semibold text-ink">
                Zmeniť skupinu udalosti na{" "}
                <span className="text-gold">„{contribGroupName}"</span>
              </p>
              <p className="mt-0.5 text-xs text-ink-dim">
                Skupina udalosti sa zmení, príspevok sa pridá bez úpravy vlastných skupín.
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
              {isSingle
                ? <>Prepísať skupiny príspevku na <span className="font-normal">„{eventGroupName}"</span></>
                : <>Prepísať skupiny {conflictingCount === 1 ? "príspevku" : `${conflictingCount} príspevkov`} na <span className="font-normal">„{eventGroupName}"</span></>
              }
            </p>
            <p className="mt-0.5 text-xs text-ink-dim">
              {isSingle
                ? `Skupiny príspevku sa nastavia na „${eventGroupName}" a príspevok sa pridá do udalosti.`
                : `Skupiny ${conflictingCount === 1 ? "príspevku" : `${conflictingCount} príspevkov`} sa nastavia na „${eventGroupName}" a všetky sa pridajú do udalosti.`
              }
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
