"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useNotificationSettings } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { getPushPermissionState, requestPushPermission } from "@/lib/pushService";
import type { NotificationPref, NotificationType } from "@/types/notification";
import { NOTIFICATION_TYPES } from "@/types/notification";

interface Props {
  onClose: () => void;
}

const PREF_OPTIONS: NotificationPref[] = ["push", "in_app", "off"];

export function NotificationSettingsModal({ onClose }: Props) {
  const { t } = useI18n();
  const { appUser, hasRole } = useAuth();
  const { settings, loading, updateSettings } = useNotificationSettings();
  const isAdmin = hasRole("admin");
  const visibleTypes = NOTIFICATION_TYPES.filter(
    (type) => type !== "access_request" || isAdmin
  );
  const [pushState, setPushState] = useState<string>("default");
  const [requestingPush, setRequestingPush] = useState(false);

  useEffect(() => {
    setPushState(getPushPermissionState());
  }, []);

  async function handleEnablePush() {
    if (!appUser?.uid) return;
    setRequestingPush(true);
    const result = await requestPushPermission(appUser.uid);
    setPushState(result);
    setRequestingPush(false);
  }

  async function handlePrefChange(type: NotificationType, pref: NotificationPref) {
    await updateSettings({ ...settings, [type]: pref });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-rim bg-surface-high shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rim px-5 py-4">
          <h2 className="text-base font-semibold text-ink">{t.notifications.settingsTitle}</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Push permission banner */}
        {pushState !== "granted" && pushState !== "unsupported" && (
          <div className="mx-5 mt-4 rounded-xl bg-gold-dim px-4 py-3">
            {pushState === "denied" ? (
              <p className="text-sm text-ink-dim">{t.notifications.pushDenied}</p>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-dim">{t.notifications.enablePushHint}</p>
                <button
                  onClick={handleEnablePush}
                  disabled={requestingPush}
                  className="shrink-0 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-gold-text transition-opacity disabled:opacity-60"
                >
                  {requestingPush ? "…" : t.notifications.enablePushBtn}
                </button>
              </div>
            )}
          </div>
        )}
        {pushState === "granted" && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-700 ring-1 ring-green-200">
            <CheckIcon />
            {t.notifications.pushGranted}
          </div>
        )}

        {/* Settings list */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-ink-subtle py-4 text-center">Načítavam…</p>
          ) : (
            <div className="space-y-1">
              {visibleTypes.map((type) => (
                <div key={type} className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-surface">
                  <span className="text-sm text-ink">{t.notifications.typeLabels[type]}</span>
                  <div className="flex shrink-0 gap-1 rounded-lg bg-surface p-0.5">
                    {PREF_OPTIONS.map((pref) => (
                      <button
                        key={pref}
                        onClick={() => handlePrefChange(type, pref)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          settings[type] === pref
                            ? "bg-surface-high text-ink shadow-sm ring-1 ring-rim"
                            : "text-ink-subtle hover:text-ink"
                        }`}
                      >
                        {t.notifications.prefLabels[pref]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="border-t border-rim px-5 py-4">
          <div className="space-y-1.5 text-xs text-ink-subtle">
            <p><span className="font-medium text-ink-dim">{t.notifications.prefLabels.push}</span> — {t.notifications.prefDescriptions.push}</p>
            <p><span className="font-medium text-ink-dim">{t.notifications.prefLabels.in_app}</span> — {t.notifications.prefDescriptions.in_app}</p>
            <p><span className="font-medium text-ink-dim">{t.notifications.prefLabels.off}</span> — {t.notifications.prefDescriptions.off}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
