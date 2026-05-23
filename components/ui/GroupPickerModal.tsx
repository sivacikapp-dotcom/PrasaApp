"use client";

import { useEffect, useState } from "react";
import { getEventGroups } from "@/lib/eventGroupService";
import type { EventGroup } from "@/types/contribution";

interface GroupPickerModalProps {
  open: boolean;
  filterContributionIds?: string[];
  onConfirm: (group: EventGroup) => Promise<void>;
  onClose: () => void;
}

export function GroupPickerModal({ open, filterContributionIds, onConfirm, onClose }: GroupPickerModalProps) {
  const [groups, setGroups] = useState<EventGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSaving(null);
    setLoading(true);
    getEventGroups().then((g) => {
      const filtered = filterContributionIds
        ? g.filter((group) => group.contributionIds.some((id) => filterContributionIds.includes(id)))
        : g;
      setGroups(filtered);
      setLoading(false);
    });
  }, [open]);

  async function handleSelect(group: EventGroup) {
    setSaving(group.id);
    try {
      await onConfirm(group);
    } finally {
      setSaving(null);
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-surface border border-rim shadow-2xl flex flex-col max-h-[70vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-rim shrink-0">
          <h2 className="text-sm font-semibold text-ink">Pridať skupinu príspevkov</h2>
          <button onClick={onClose} className="p-1 text-ink-subtle hover:text-ink">
            <XIcon />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="py-10 text-center text-sm text-ink-subtle">Načítavam…</div>
          ) : groups.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-subtle">Žiadne skupiny.</div>
          ) : (
            groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => handleSelect(g)}
                disabled={saving !== null}
                className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-rim last:border-0 hover:bg-surface-high disabled:opacity-50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-high text-ink-subtle">
                  <FolderIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{g.title}</p>
                  <p className="text-xs text-ink-subtle">{g.contributionIds.length} príspevkov</p>
                </div>
                {saving === g.id && (
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

function FolderIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}
