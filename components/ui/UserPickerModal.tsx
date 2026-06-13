"use client";

import { useEffect, useState } from "react";
import { getAllUsers } from "@/lib/userService";
import { useI18n } from "@/contexts/I18nContext";
import type { AppUser } from "@/types/user";

interface UserPickerModalProps {
  open: boolean;
  excludeIds: string[];
  onConfirm: (user: AppUser) => Promise<void>;
  onClose: () => void;
}

export function UserPickerModal({ open, excludeIds, onConfirm, onClose }: UserPickerModalProps) {
  const { t } = useI18n();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSaving(null);
    setLoading(true);
    getAllUsers().then((all) => {
      setUsers(all.filter((u) => u.status === "active" && !excludeIds.includes(u.uid)));
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSelect(user: AppUser) {
    setSaving(user.uid);
    try {
      await onConfirm(user);
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-rim shrink-0">
          <h2 className="text-sm font-semibold text-ink">{t.components.userPickerTitle}</h2>
          <button onClick={onClose} className="p-1 text-ink-subtle hover:text-ink">
            <XIcon />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="py-10 text-center text-sm text-ink-subtle">{t.components.loadingContribs}</div>
          ) : users.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-subtle">{t.components.userPickerEmpty}</div>
          ) : (
            users.map((u) => (
              <button
                key={u.uid}
                type="button"
                onClick={() => handleSelect(u)}
                disabled={saving !== null}
                className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-rim last:border-0 hover:bg-surface-high disabled:opacity-50"
              >
                {u.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.photoURL} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                    <UserIcon />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{u.displayName || u.email}</p>
                  <p className="text-xs text-ink-subtle truncate">{u.email}</p>
                </div>
                {saving === u.uid && (
                  <span className="text-xs text-ink-subtle shrink-0">{t.components.addingBtn}</span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-3 border-t border-rim shrink-0">
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-rim py-2.5 text-sm font-medium text-ink-dim hover:bg-surface-high"
          >
            {t.components.cancelBtn}
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

function UserIcon() {
  return (
    <svg className="h-4 w-4 text-ink-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
