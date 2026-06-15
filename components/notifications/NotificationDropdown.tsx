"use client";

import { useI18n } from "@/contexts/I18nContext";
import { NotificationItem } from "./NotificationItem";
import type { AppNotification } from "@/types/notification";

interface Props {
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function NotificationDropdown({ notifications, onMarkAllRead, onMarkRead, onClose, onOpenSettings }: Props) {
  const { t } = useI18n();
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-rim bg-surface-high shadow-lg overflow-hidden">
      <div className="flex items-center justify-between border-b border-rim px-4 py-3">
        <span className="text-sm font-semibold text-ink">Notifikácie</span>
        <div className="flex items-center gap-3">
          {hasUnread && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-gold transition-colors hover:text-gold/70"
            >
              {t.notifications.markAllRead}
            </button>
          )}
          <button
            onClick={() => { onClose(); onOpenSettings(); }}
            className="text-ink-subtle transition-colors hover:text-ink"
            aria-label="Nastavenia notifikácií"
          >
            <SettingsIcon />
          </button>
        </div>
      </div>

      <div className="max-h-[28rem] overflow-y-auto divide-y divide-rim/50">
        {notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-subtle">
            {t.notifications.empty}
          </p>
        ) : (
          notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onRead={() => onMarkRead(n.id)}
              onClose={onClose}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
