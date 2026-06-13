"use client";

import Link from "next/link";
import { useState } from "react";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { ContributionCard } from "@/components/contributions/ContributionCard";
import { QuickCapture } from "@/components/QuickCapture";
import { PageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import {
  useMyContributions,
  useProcessedAccessibleContributions,
  useEventMembership,
} from "@/hooks/useContributions";
import type { Contribution } from "@/types/contribution";

type MainTab = "mine" | "allProcessed";
type StatusFilter = "all" | "processed" | "pending";
type EventFilter = "all" | "inEvent" | "notInEvent";
type OwnershipFilter = "all" | "mine" | "notMine";
type SortOrder = "dateDesc" | "dateAsc";

function applySort(items: Contribution[], order: SortOrder): Contribution[] {
  return [...items].sort((a, b) => {
    const diff = a.eventDate.getTime() - b.eventDate.getTime();
    return order === "dateDesc" ? -diff : diff;
  });
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-gold text-gold-text"
          : "bg-surface-high text-ink-dim hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  label,
  children,
  sortOrder,
  onSortToggle,
}: {
  label: string;
  children: React.ReactNode;
  sortOrder?: SortOrder;
  onSortToggle?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {children}
        {sortOrder !== undefined && onSortToggle && (
          <button
            onClick={onSortToggle}
            className="ml-auto flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-dim hover:text-ink"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 6h18M6 12h12M9 18h6" />
            </svg>
            {sortOrder === "dateDesc" ? t.dashboard.sortDateDesc : t.dashboard.sortDateAsc}
          </button>
        )}
      </div>
    </div>
  );
}

function DashboardContent() {
  const { appUser } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<MainTab>("mine");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [mineEventFilter, setMineEventFilter] = useState<EventFilter>("all");
  const [mineSortOrder, setMineSortOrder] = useState<SortOrder>("dateDesc");

  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [allEventFilter, setAllEventFilter] = useState<EventFilter>("all");
  const [allSortOrder, setAllSortOrder] = useState<SortOrder>("dateDesc");

  const uid = appUser?.uid;
  const { contributions: mine, loading: loadMine } = useMyContributions(uid);
  const { contributions: allProcessed, loading: loadAllProcessed } =
    useProcessedAccessibleContributions(uid);
  const eventIds = useEventMembership();

  const loading = tab === "mine" ? loadMine : loadAllProcessed;

  const displayedMine = (() => {
    let r = mine;
    if (statusFilter === "processed") r = r.filter((c) => c.status === "processed");
    else if (statusFilter === "pending") r = r.filter((c) => c.status === "pending");
    if (mineEventFilter === "inEvent") r = r.filter((c) => eventIds.has(c.id));
    else if (mineEventFilter === "notInEvent") r = r.filter((c) => !eventIds.has(c.id));
    return applySort(r, mineSortOrder);
  })();

  const displayedAll = (() => {
    let r = allProcessed;
    if (ownershipFilter === "mine") r = r.filter((c) => c.contributorId === uid);
    else if (ownershipFilter === "notMine") r = r.filter((c) => c.contributorId !== uid);
    if (allEventFilter === "inEvent") r = r.filter((c) => eventIds.has(c.id));
    else if (allEventFilter === "notInEvent") r = r.filter((c) => !eventIds.has(c.id));
    return applySort(r, allSortOrder);
  })();

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
        <QuickCapture />

        {/* Main Tabs */}
        <div className="mb-4 flex rounded-xl border border-rim bg-surface p-1">
          {(["mine", "allProcessed"] as MainTab[]).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
                tab === tabKey
                  ? "bg-gold text-gold-text shadow-sm"
                  : "text-ink-dim hover:text-ink"
              }`}
            >
              {tabKey === "mine"
                ? t.dashboard.myContributions
                : t.dashboard.allProcessedContributions}
            </button>
          ))}
        </div>

        {/* Filters: Moje príspevky */}
        {tab === "mine" && (
          <div className="mb-4 rounded-xl border border-rim bg-surface px-3 py-2.5 space-y-3">
            <FilterGroup label={t.dashboard.filterLabelStatus}>
              <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
                {t.dashboard.filterAll}
              </FilterChip>
              <FilterChip active={statusFilter === "processed"} onClick={() => setStatusFilter("processed")}>
                {t.dashboard.filterStatusProcessed}
              </FilterChip>
              <FilterChip active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")}>
                {t.dashboard.filterStatusPending}
              </FilterChip>
            </FilterGroup>
            <FilterGroup
              label={t.dashboard.filterLabelEvent}
              sortOrder={mineSortOrder}
              onSortToggle={() => setMineSortOrder((o) => (o === "dateDesc" ? "dateAsc" : "dateDesc"))}
            >
              <FilterChip active={mineEventFilter === "all"} onClick={() => setMineEventFilter("all")}>
                {t.dashboard.filterAll}
              </FilterChip>
              <FilterChip active={mineEventFilter === "inEvent"} onClick={() => setMineEventFilter("inEvent")}>
                {t.dashboard.filterInEvent}
              </FilterChip>
              <FilterChip active={mineEventFilter === "notInEvent"} onClick={() => setMineEventFilter("notInEvent")}>
                {t.dashboard.filterNotInEvent}
              </FilterChip>
            </FilterGroup>
          </div>
        )}

        {/* Filters: Všetky spracované */}
        {tab === "allProcessed" && (
          <div className="mb-4 rounded-xl border border-rim bg-surface px-3 py-2.5 space-y-3">
            <FilterGroup label={t.dashboard.filterLabelOwnership}>
              <FilterChip active={ownershipFilter === "all"} onClick={() => setOwnershipFilter("all")}>
                {t.dashboard.filterAll}
              </FilterChip>
              <FilterChip active={ownershipFilter === "mine"} onClick={() => setOwnershipFilter("mine")}>
                {t.dashboard.filterMine}
              </FilterChip>
              <FilterChip active={ownershipFilter === "notMine"} onClick={() => setOwnershipFilter("notMine")}>
                {t.dashboard.filterNotMine}
              </FilterChip>
            </FilterGroup>
            <FilterGroup
              label={t.dashboard.filterLabelEvent}
              sortOrder={allSortOrder}
              onSortToggle={() => setAllSortOrder((o) => (o === "dateDesc" ? "dateAsc" : "dateDesc"))}
            >
              <FilterChip active={allEventFilter === "all"} onClick={() => setAllEventFilter("all")}>
                {t.dashboard.filterAll}
              </FilterChip>
              <FilterChip active={allEventFilter === "inEvent"} onClick={() => setAllEventFilter("inEvent")}>
                {t.dashboard.filterInEvent}
              </FilterChip>
              <FilterChip active={allEventFilter === "notInEvent"} onClick={() => setAllEventFilter("notInEvent")}>
                {t.dashboard.filterNotInEvent}
              </FilterChip>
            </FilterGroup>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <PageSpinner />
        ) : tab === "mine" ? (
          displayedMine.length === 0 ? (
            <MineEmptyState hasAny={mine.length > 0} />
          ) : (
            <div className="space-y-3">
              {displayedMine.map((c) => (
                <ContributionCard key={c.id} contribution={c} href={`/dashboard/${c.id}`} />
              ))}
            </div>
          )
        ) : displayedAll.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
              <svg
                className="h-7 w-7 text-ink-subtle"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path d="M9 12h6M9 16h6M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
              </svg>
            </div>
            <p className="text-sm text-ink-dim">{t.dashboard.allProcessedEmpty}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedAll.map((c) => (
              <ContributionCard key={c.id} contribution={c} href={`/dashboard/${c.id}`} />
            ))}
          </div>
        )}
      </main>

      {/* FAB */}
      <Link
        href="/dashboard/new"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-gold-text shadow-lg hover:bg-gold-hover active:scale-95 transition-transform"
        aria-label={t.dashboard.newContributionAriaLabel}
      >
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </Link>
    </>
  );
}

function MineEmptyState({ hasAny }: { hasAny: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
        <svg
          className="h-7 w-7 text-ink-subtle"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M9 12h6M9 16h6M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
        </svg>
      </div>
      {hasAny ? (
        <p className="text-sm text-ink-dim">{t.dashboard.emptyState}</p>
      ) : (
        <>
          <p className="text-sm text-ink-dim">{t.dashboard.mineEmpty}</p>
          <Link
            href="/dashboard/new"
            className="text-sm font-medium text-gold hover:underline"
          >
            {t.dashboard.mineAddFirst}
          </Link>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RouteGuard>
      <DashboardContent />
    </RouteGuard>
  );
}
