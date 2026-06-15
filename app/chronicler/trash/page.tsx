"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { PageSpinner } from "@/components/ui/Spinner";
import { ConfirmModal } from "@/components/ui/Modal";
import { useTrashedContributions } from "@/hooks/useContributions";
import { restoreContribution, permanentlyDeleteContribution, batchRestore, batchPermanentlyDelete } from "@/lib/contributionService";
import { useI18n } from "@/contexts/I18nContext";
import type { Contribution } from "@/types/contribution";

type SortKey =
  | "deleted-desc"
  | "deleted-asc"
  | "date-desc"
  | "date-asc"
  | "contributor-asc"
  | "contributor-desc";

function TrashContent() {
  const { t, dateFnsLocale } = useI18n();
  const { contributions, loading } = useTrashedContributions();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("deleted-desc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterDeletedFrom, setFilterDeletedFrom] = useState("");
  const [filterDeletedTo, setFilterDeletedTo] = useState("");
  const [filterContributors, setFilterContributors] = useState<Set<string>>(new Set());

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // single-item action state
  const [restoreTarget, setRestoreTarget] = useState<Contribution | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contribution | null>(null);
  const [actioning, setActioning] = useState(false);

  // batch action state
  const [batchRestoreOpen, setBatchRestoreOpen] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchActioning, setBatchActioning] = useState(false);

  const allContributors = useMemo(() => {
    const map = new Map<string, string>();
    contributions.forEach((c) => map.set(c.contributorId, c.contributorName));
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "sk"));
  }, [contributions]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterDateFrom || filterDateTo) n++;
    if (filterDeletedFrom || filterDeletedTo) n++;
    if (filterContributors.size > 0) n++;
    return n;
  }, [filterDateFrom, filterDateTo, filterDeletedFrom, filterDeletedTo, filterContributors]);

  function clearFilters() {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterDeletedFrom("");
    setFilterDeletedTo("");
    setFilterContributors(new Set());
  }

  function toggleSet<T>(prev: Set<T>, value: T): Set<T> {
    const next = new Set(prev);
    next.has(value) ? next.delete(value) : next.add(value);
    return next;
  }

  const displayed = useMemo(() => {
    let list = [...contributions];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.texts.some((txt) => txt.toLowerCase().includes(q)) ||
          c.contributorName.toLowerCase().includes(q) ||
          (c.chroniclerText ?? "").toLowerCase().includes(q)
      );
    }

    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      list = list.filter((c) => (c.verifiedEventDate ?? c.eventDate) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((c) => (c.verifiedEventDate ?? c.eventDate) <= to);
    }
    if (filterDeletedFrom) {
      const from = new Date(filterDeletedFrom);
      list = list.filter((c) => (c.deletedAt ?? c.updatedAt) >= from);
    }
    if (filterDeletedTo) {
      const to = new Date(filterDeletedTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((c) => (c.deletedAt ?? c.updatedAt) <= to);
    }
    if (filterContributors.size > 0) {
      list = list.filter((c) => filterContributors.has(c.contributorId));
    }

    list.sort((a, b) => {
      if (sortKey === "deleted-desc" || sortKey === "deleted-asc") {
        const ta = (a.deletedAt ?? a.updatedAt).getTime();
        const tb = (b.deletedAt ?? b.updatedAt).getTime();
        return sortKey === "deleted-desc" ? tb - ta : ta - tb;
      }
      if (sortKey === "date-asc" || sortKey === "date-desc") {
        const diff =
          (a.verifiedEventDate ?? a.eventDate).getTime() -
          (b.verifiedEventDate ?? b.eventDate).getTime();
        return sortKey === "date-asc" ? diff : -diff;
      }
      const cmp = a.contributorName.localeCompare(b.contributorName, "sk");
      return sortKey === "contributor-asc" ? cmp : -cmp;
    });

    return list;
  }, [contributions, search, sortKey, filterDateFrom, filterDateTo, filterDeletedFrom, filterDeletedTo, filterContributors]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => toggleSet(prev, id));
  }

  function selectAll() {
    setSelectedIds(new Set(displayed.map((c) => c.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  async function handleRestore(c: Contribution) {
    setActioning(true);
    await restoreContribution(c.id);
    setActioning(false);
    setRestoreTarget(null);
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(c.id); return next; });
  }

  async function handlePermanentDelete(c: Contribution) {
    setActioning(true);
    await permanentlyDeleteContribution(c.id);
    setActioning(false);
    setDeleteTarget(null);
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(c.id); return next; });
  }

  async function handleBatchRestore() {
    setBatchActioning(true);
    await batchRestore(Array.from(selectedIds));
    setBatchActioning(false);
    setBatchRestoreOpen(false);
    setSelectedIds(new Set());
  }

  async function handleBatchDelete() {
    setBatchActioning(true);
    await batchPermanentlyDelete(Array.from(selectedIds));
    setBatchActioning(false);
    setBatchDeleteOpen(false);
    setSelectedIds(new Set());
  }

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "deleted-desc", label: t.trash.sortDeletedDesc },
    { key: "deleted-asc", label: t.trash.sortDeletedAsc },
    { key: "date-desc", label: t.trash.sortDateDesc },
    { key: "date-asc", label: t.trash.sortDateAsc },
    { key: "contributor-asc", label: t.trash.sortContributorAsc },
    { key: "contributor-desc", label: t.trash.sortContributorDesc },
  ];

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-6 pb-28 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/chronicler"
            className="text-sm text-ink-dim hover:text-ink"
          >
            {t.trash.backBtn}
          </Link>
          <h1 className="text-lg font-semibold text-ink flex-1">{t.trash.title}</h1>
        </div>

        {/* Search + filter row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder={t.trash.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-rim bg-surface pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`relative flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
              filterOpen || activeFilterCount > 0
                ? "border-gold bg-gold-dim text-gold"
                : "border-rim bg-surface text-ink-dim hover:text-ink"
            }`}
          >
            <FilterIcon />
            {t.trash.filtersBtn}
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-gold-text">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-ink-subtle shrink-0">{t.trash.sortLabel}</span>
          {SORT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                sortKey === key
                  ? "border-gold bg-gold-dim text-gold"
                  : "border-rim text-ink-dim hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filter panel */}
        {filterOpen && (
          <div className="rounded-xl border border-rim bg-surface p-4 space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.trash.filterDateRange}</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-ink-subtle mb-1">{t.trash.filterFrom}</label>
                  <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="w-full rounded-lg border border-rim bg-canvas px-2 py-1.5 text-xs text-ink focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-ink-subtle mb-1">{t.trash.filterTo}</label>
                  <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                    className="w-full rounded-lg border border-rim bg-canvas px-2 py-1.5 text-xs text-ink focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.trash.filterDeletedRange}</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-ink-subtle mb-1">{t.trash.filterFrom}</label>
                  <input type="date" value={filterDeletedFrom} onChange={(e) => setFilterDeletedFrom(e.target.value)}
                    className="w-full rounded-lg border border-rim bg-canvas px-2 py-1.5 text-xs text-ink focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-ink-subtle mb-1">{t.trash.filterTo}</label>
                  <input type="date" value={filterDeletedTo} onChange={(e) => setFilterDeletedTo(e.target.value)}
                    className="w-full rounded-lg border border-rim bg-canvas px-2 py-1.5 text-xs text-ink focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" />
                </div>
              </div>
            </div>

            {allContributors.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.trash.filterContributor}</p>
                <div className="flex flex-wrap gap-1.5">
                  {allContributors.map(({ id, name }) => {
                    const active = filterContributors.has(id);
                    return (
                      <button
                        key={id}
                        onClick={() => setFilterContributors((prev) => toggleSet(prev, id))}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                          active ? "border-gold bg-gold-dim text-gold" : "border-rim text-ink-dim hover:text-ink"
                        }`}
                      >
                        {active && <CheckSmallIcon />}
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-danger hover:underline">
                {t.trash.clearFilters}
              </button>
            )}
          </div>
        )}

        {/* Select all / deselect bar */}
        {displayed.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={selectedIds.size === displayed.length ? deselectAll : selectAll}
              className="text-xs text-ink-dim hover:text-ink underline"
            >
              {selectedIds.size === displayed.length ? t.trash.deselectAll : t.trash.selectAll}
            </button>
            {selectedIds.size > 0 && (
              <span className="text-xs text-ink-subtle">
                {t.trash.selectedCount(selectedIds.size)}
              </span>
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <PageSpinner />
        ) : displayed.length === 0 ? (
          <div className="py-12 text-center text-sm text-ink-subtle">
            {activeFilterCount > 0 || search.trim() ? t.trash.noMatch : t.trash.empty}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((c) => {
              const displayDate = c.verifiedEventDate ?? c.eventDate;
              const deletedDate = c.deletedAt ?? c.updatedAt;
              const isSelected = selectedIds.has(c.id);
              return (
                <article
                  key={c.id}
                  onClick={() => toggleSelect(c.id)}
                  className={`cursor-pointer rounded-xl border bg-surface p-4 shadow-sm transition-colors space-y-2 ${
                    isSelected ? "border-danger bg-danger-dim" : "border-rim hover:border-rim-strong hover:bg-surface-high"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {/* Checkbox */}
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected ? "border-danger bg-danger" : "border-rim-strong bg-surface"
                    }`}>
                      {isSelected && (
                        <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="currentColor">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                        </svg>
                      )}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gold uppercase tracking-wide">
                        {format(displayDate, "d. MMMM yyyy", { locale: dateFnsLocale })}
                      </p>
                      <p className="text-xs text-ink-subtle">{c.contributorName}</p>
                    </div>

                    <p className="text-[10px] text-danger shrink-0">
                      {t.trash.deletedAtLabel(format(deletedDate, "d.M.yyyy", { locale: dateFnsLocale }))}
                    </p>
                  </div>

                  {c.texts[0] ? (
                    <p className="text-sm text-ink line-clamp-2">{c.texts[0]}</p>
                  ) : (
                    <p className="text-sm text-ink-subtle italic">{t.trash.noText}</p>
                  )}

                  {/* Actions */}
                  <div
                    className="flex gap-2 pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setRestoreTarget(c)}
                      className="flex items-center gap-1 rounded-lg border border-rim px-2.5 py-1 text-xs text-ink-dim hover:bg-surface-high hover:text-ink transition-colors"
                    >
                      <RestoreIcon /> {t.trash.restoreBtn}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(c)}
                      className="flex items-center gap-1 rounded-lg border border-danger/40 px-2.5 py-1 text-xs text-danger hover:bg-danger/10 transition-colors"
                    >
                      <TrashIcon /> {t.trash.deleteBtn}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-rim bg-surface-high px-4 py-3">
          <div className="mx-auto max-w-2xl space-y-2">
            <p className="text-xs font-medium text-ink-dim text-center">
              {t.trash.selectedCount(selectedIds.size)}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setBatchRestoreOpen(true)}
                disabled={batchActioning}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-rim bg-surface py-2 text-sm font-medium text-ink-dim hover:bg-surface-high hover:text-ink disabled:opacity-50 transition-colors"
              >
                <RestoreIcon /> {t.trash.batchRestore}
              </button>
              <button
                onClick={() => setBatchDeleteOpen(true)}
                disabled={batchActioning}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-danger/40 bg-danger-dim py-2 text-sm font-medium text-danger hover:bg-danger/20 disabled:opacity-50 transition-colors"
              >
                <TrashIcon /> {t.trash.batchDelete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single restore confirm */}
      <ConfirmModal
        open={restoreTarget !== null}
        title={t.trash.restoreTitle}
        message={t.trash.restoreMessage}
        confirmLabel={t.trash.restoreConfirm}
        onConfirm={() => restoreTarget && handleRestore(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
      />

      {/* Single permanent delete confirm */}
      <ConfirmModal
        open={deleteTarget !== null}
        title={t.trash.permanentDeleteTitle}
        message={t.trash.permanentDeleteMessage(1)}
        confirmLabel={t.trash.permanentDeleteConfirm}
        onConfirm={() => deleteTarget && handlePermanentDelete(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        danger
      />

      {/* Batch restore confirm */}
      <ConfirmModal
        open={batchRestoreOpen}
        title={t.trash.restoreTitle}
        message={t.trash.restoreMessage}
        confirmLabel={t.trash.batchRestore}
        onConfirm={handleBatchRestore}
        onClose={() => setBatchRestoreOpen(false)}
      />

      {/* Batch permanent delete confirm */}
      <ConfirmModal
        open={batchDeleteOpen}
        title={t.trash.permanentDeleteTitle}
        message={t.trash.permanentDeleteMessage(selectedIds.size)}
        confirmLabel={t.trash.permanentDeleteConfirm}
        onConfirm={handleBatchDelete}
        onClose={() => setBatchDeleteOpen(false)}
        danger
      />
    </>
  );
}

export default function ChroniclerTrashPage() {
  return <RouteGuard requiredRole="chronicler"><TrashContent /></RouteGuard>;
}

function FilterIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  );
}

function CheckSmallIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M1.5 6l3 3 6-6" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
