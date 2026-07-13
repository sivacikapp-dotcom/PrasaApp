"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useNotificationSettings } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { getPushPermissionState, requestPushPermission } from "@/lib/pushService";
import { getCategories } from "@/lib/categoryService";
import type { NotificationPref, NotificationType } from "@/types/notification";
import { NOTIFICATION_TYPES } from "@/types/notification";
import type { Group } from "@/types/contribution";
import type {
  ContributionListPrefs,
  EventListPrefs,
  SortOrder,
  TaggedUsersVisibility,
} from "@/types/userPreferences";

export type SettingsTab = "contributions" | "events" | "notifications" | "groups";

interface Props {
  onClose: () => void;
  defaultTab?: SettingsTab;
}

const NOTIF_PREF_OPTIONS: NotificationPref[] = ["push", "in_app", "off"];

export function SettingsModal({ onClose, defaultTab = "contributions" }: Props) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);
  const { prefs, loading: prefsLoading, updatePrefs } = useUserPreferences();
  const { settings: notifSettings, loading: notifLoading, updateSettings } = useNotificationSettings();
  const { appUser } = useAuth();
  const [pushState, setPushState] = useState("default");
  const [requestingPush, setRequestingPush] = useState(false);
  const [accessibleGroups, setAccessibleGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  useEffect(() => {
    setPushState(getPushPermissionState());
  }, []);

  useEffect(() => {
    if (!appUser?.uid) return;
    getCategories().then((cats) => {
      setAccessibleGroups(cats.filter((c) => c.allowedUserIds.includes(appUser.uid)));
      setGroupsLoading(false);
    });
  }, [appUser?.uid]);

  async function handleEnablePush() {
    if (!appUser?.uid) return;
    setRequestingPush(true);
    const result = await requestPushPermission(appUser.uid);
    setPushState(result);
    setRequestingPush(false);
  }

  function updateContrib<K extends keyof ContributionListPrefs>(
    key: K,
    value: ContributionListPrefs[K]
  ) {
    updatePrefs({ ...prefs, contributions: { ...prefs.contributions, [key]: value } });
  }

  function updateEvent<K extends keyof EventListPrefs>(
    key: K,
    value: EventListPrefs[K]
  ) {
    updatePrefs({ ...prefs, events: { ...prefs.events, [key]: value } });
  }

  function toggleDefaultGroup(groupId: string) {
    const current = new Set(prefs.defaultGroupIds);
    if (current.has(groupId)) current.delete(groupId); else current.add(groupId);
    updatePrefs({ ...prefs, defaultGroupIds: Array.from(current) });
  }

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: "contributions", label: t.settings.tabContributions },
    { key: "events", label: t.settings.tabEvents },
    { key: "groups", label: t.settings.tabGroups },
    { key: "notifications", label: t.settings.tabNotifications },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex w-full flex-col rounded-t-2xl border border-rim bg-surface-high shadow-2xl sm:max-w-lg sm:rounded-2xl" style={{ maxHeight: "90dvh" }}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-rim px-5 py-4">
          <h2 className="text-base font-semibold text-ink">{t.settings.title}</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface hover:text-ink"
            aria-label="Zavrieť"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-rim">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors sm:text-sm ${
                activeTab === tab.key
                  ? "border-b-2 border-gold text-gold"
                  : "text-ink-dim hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeTab === "contributions" && (
            <ContributionsTab
              prefs={prefs.contributions}
              loading={prefsLoading}
              onChange={updateContrib}
            />
          )}
          {activeTab === "events" && (
            <EventsTab
              prefs={prefs.events}
              loading={prefsLoading}
              onChange={updateEvent}
            />
          )}
          {activeTab === "groups" && (
            <GroupsTab
              groups={accessibleGroups}
              loading={prefsLoading || groupsLoading}
              selectedIds={prefs.defaultGroupIds}
              onToggle={toggleDefaultGroup}
            />
          )}
          {activeTab === "notifications" && (
            <NotificationsTab
              settings={notifSettings}
              loading={notifLoading}
              pushState={pushState}
              requestingPush={requestingPush}
              onUpdatePref={(type, pref) =>
                updateSettings({ ...notifSettings, [type]: pref })
              }
              onEnablePush={handleEnablePush}
              isChronicler={appUser?.roles.includes("chronicler") ?? false}
              emailNewContribution={prefs.emailNewContribution}
              emailPrefLoading={prefsLoading}
              onToggleEmailNewContribution={(value) => updatePrefs({ ...prefs, emailNewContribution: value })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Contributions tab ─────────────────────────────────────────────────────────

interface ContribTabProps {
  prefs: ContributionListPrefs;
  loading: boolean;
  onChange: <K extends keyof ContributionListPrefs>(k: K, v: ContributionListPrefs[K]) => void;
}

function ContributionsTab({ prefs, loading, onChange }: ContribTabProps) {
  const { t } = useI18n();
  if (loading) return <LoadingRow />;
  return (
    <div className="space-y-1">
      <SectionHeading>{t.settings.contributions.heading}</SectionHeading>

      <SortRow
        label={t.settings.contributions.defaultSort}
        value={prefs.defaultSort}
        onChange={(v) => onChange("defaultSort", v)}
      />

      <BoolRow
        label={t.settings.contributions.showLocation}
        value={prefs.showLocation}
        onChange={(v) => onChange("showLocation", v)}
      />

      <BoolRow
        label={t.settings.contributions.showContributor}
        value={prefs.showContributor}
        onChange={(v) => onChange("showContributor", v)}
      />

      <BoolRow
        label={t.settings.contributions.showContentTypes}
        value={prefs.showContentTypes}
        onChange={(v) => onChange("showContentTypes", v)}
      />

      <BoolRow
        label={t.settings.contributions.showPhotoPreview}
        value={prefs.showPhotoPreview}
        onChange={(v) => onChange("showPhotoPreview", v)}
      />

      <TaggedRow
        label={t.settings.contributions.showTaggedUsers}
        value={prefs.showTaggedUsers}
        onChange={(v) => onChange("showTaggedUsers", v)}
      />
    </div>
  );
}

// ── Events tab ────────────────────────────────────────────────────────────────

interface EventsTabProps {
  prefs: EventListPrefs;
  loading: boolean;
  onChange: <K extends keyof EventListPrefs>(k: K, v: EventListPrefs[K]) => void;
}

function EventsTab({ prefs, loading, onChange }: EventsTabProps) {
  const { t } = useI18n();
  if (loading) return <LoadingRow />;
  return (
    <div className="space-y-1">
      <SectionHeading>{t.settings.events.heading}</SectionHeading>

      <SortRow
        label={t.settings.events.defaultSort}
        value={prefs.defaultSort}
        onChange={(v) => onChange("defaultSort", v)}
      />

      <BoolRow
        label={t.settings.events.showLastModified}
        value={prefs.showLastModified}
        onChange={(v) => onChange("showLastModified", v)}
      />

      <BoolRow
        label={t.settings.events.showLocation}
        value={prefs.showLocation}
        onChange={(v) => onChange("showLocation", v)}
      />

      <BoolRow
        label={t.settings.events.showContributionCount}
        value={prefs.showContributionCount}
        onChange={(v) => onChange("showContributionCount", v)}
      />

      <TaggedRow
        label={t.settings.events.showTaggedUsers}
        value={prefs.showTaggedUsers}
        onChange={(v) => onChange("showTaggedUsers", v)}
      />
    </div>
  );
}

// ── Groups tab ────────────────────────────────────────────────────────────────

interface GroupsTabProps {
  groups: Group[];
  loading: boolean;
  selectedIds: string[];
  onToggle: (groupId: string) => void;
}

function GroupsTab({ groups, loading, selectedIds, onToggle }: GroupsTabProps) {
  const { t } = useI18n();
  if (loading) return <LoadingRow />;
  return (
    <div className="space-y-2">
      <SectionHeading>{t.settings.groups.heading}</SectionHeading>
      <p className="px-3 text-xs text-ink-subtle">{t.settings.groups.hint}</p>
      {groups.length === 0 ? (
        <p className="px-3 py-4 text-sm text-ink-subtle">{t.settings.groups.noGroups}</p>
      ) : (
        <div className="flex flex-wrap gap-2 px-3 py-2">
          {groups.map((g) => {
            const selected = selectedIds.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onToggle(g.id)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  selected
                    ? "border-transparent text-gold-text"
                    : "border-rim text-ink-dim hover:border-rim-strong"
                }`}
                style={selected ? { backgroundColor: g.color, borderColor: g.color } : {}}
              >
                {g.icon ? g.icon + " " + g.name : g.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Notifications tab ─────────────────────────────────────────────────────────

interface NotifTabProps {
  settings: Record<NotificationType, NotificationPref>;
  loading: boolean;
  pushState: string;
  requestingPush: boolean;
  onUpdatePref: (type: NotificationType, pref: NotificationPref) => void;
  onEnablePush: () => void;
  isChronicler: boolean;
  emailNewContribution: boolean;
  emailPrefLoading: boolean;
  onToggleEmailNewContribution: (value: boolean) => void;
}

function NotificationsTab({
  settings,
  loading,
  pushState,
  requestingPush,
  onUpdatePref,
  onEnablePush,
  isChronicler,
  emailNewContribution,
  emailPrefLoading,
  onToggleEmailNewContribution,
}: NotifTabProps) {
  const { t } = useI18n();
  return (
    <div>
      {/* Push permission banner */}
      {pushState !== "granted" && pushState !== "unsupported" && (
        <div className="mb-4 rounded-xl bg-gold-dim px-4 py-3">
          {pushState === "denied" ? (
            <p className="text-sm text-ink-dim">{t.notifications.pushDenied}</p>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink-dim">{t.notifications.enablePushHint}</p>
              <button
                onClick={onEnablePush}
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
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-700 ring-1 ring-green-200">
          <CheckIcon />
          {t.notifications.pushGranted}
        </div>
      )}

      {loading ? (
        <LoadingRow />
      ) : (
        <div className="space-y-1">
          {NOTIFICATION_TYPES.map((type) => (
            <div
              key={type}
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-surface"
            >
              <span className="text-sm text-ink">{t.notifications.typeLabels[type]}</span>
              <div className="flex shrink-0 gap-1 rounded-lg bg-surface p-0.5">
                {NOTIF_PREF_OPTIONS.map((pref) => (
                  <button
                    key={pref}
                    onClick={() => onUpdatePref(type, pref)}
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

      <div className="mt-4 border-t border-rim pt-4 space-y-1.5 text-xs text-ink-subtle">
        <p>
          <span className="font-medium text-ink-dim">{t.notifications.prefLabels.push}</span>
          {" — "}{t.notifications.prefDescriptions.push}
        </p>
        <p>
          <span className="font-medium text-ink-dim">{t.notifications.prefLabels.in_app}</span>
          {" — "}{t.notifications.prefDescriptions.in_app}
        </p>
        <p>
          <span className="font-medium text-ink-dim">{t.notifications.prefLabels.off}</span>
          {" — "}{t.notifications.prefDescriptions.off}
        </p>
      </div>

      {isChronicler && (
        <div className="mt-4 border-t border-rim pt-4">
          <SectionHeading>{t.notifications.emailHeading}</SectionHeading>
          {emailPrefLoading ? (
            <LoadingRow />
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-surface">
              <div>
                <p className="text-sm text-ink">{t.notifications.emailNewContributionLabel}</p>
                <p className="text-xs text-ink-subtle">{t.notifications.emailNewContributionHint}</p>
              </div>
              <SegmentedControl<boolean>
                options={[
                  { value: true, label: t.settings.optionYes },
                  { value: false, label: t.settings.optionNo },
                ]}
                value={emailNewContribution}
                onChange={onToggleEmailNewContribution}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 px-3 pt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
      {children}
    </p>
  );
}

function LoadingRow() {
  return <p className="py-6 text-center text-sm text-ink-subtle">…</p>;
}

interface SortRowProps {
  label: string;
  value: SortOrder;
  onChange: (v: SortOrder) => void;
}

function SortRow({ label, value, onChange }: SortRowProps) {
  const { t } = useI18n();
  return (
    <SettingRow label={label}>
      <SegmentedControl<SortOrder>
        options={[
          { value: "desc", label: t.settings.optionSortDesc },
          { value: "asc", label: t.settings.optionSortAsc },
        ]}
        value={value}
        onChange={onChange}
      />
    </SettingRow>
  );
}

interface BoolRowProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function BoolRow({ label, value, onChange }: BoolRowProps) {
  const { t } = useI18n();
  return (
    <SettingRow label={label}>
      <SegmentedControl<boolean>
        options={[
          { value: true, label: t.settings.optionYes },
          { value: false, label: t.settings.optionNo },
        ]}
        value={value}
        onChange={onChange}
      />
    </SettingRow>
  );
}

interface TaggedRowProps {
  label: string;
  value: TaggedUsersVisibility;
  onChange: (v: TaggedUsersVisibility) => void;
}

function TaggedRow({ label, value, onChange }: TaggedRowProps) {
  const { t } = useI18n();
  return (
    <SettingRow label={label}>
      <SegmentedControl<TaggedUsersVisibility>
        options={[
          { value: "yes", label: t.settings.optionYes },
          { value: "only_me", label: t.settings.optionOnlyMe },
          { value: "no", label: t.settings.optionNo },
        ]}
        value={value}
        onChange={onChange}
      />
    </SettingRow>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 hover:bg-surface">
      <span className="text-sm text-ink">{label}</span>
      {children}
    </div>
  );
}

interface SegmentedOption<T> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
}

function SegmentedControl<T>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="flex shrink-0 gap-1 rounded-lg bg-surface p-0.5">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-surface-high text-ink shadow-sm ring-1 ring-rim"
              : "text-ink-subtle hover:text-ink"
          }`}
        >
          {opt.label}
        </button>
      ))}
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
