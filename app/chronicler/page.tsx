"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { PageSpinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ContributionCard } from "@/components/contributions/ContributionCard";
import { EventGroupCard } from "@/components/contributions/EventGroupCard";
import { EventCard } from "@/components/contributions/EventCard";
import { useAllContributions } from "@/hooks/useContributions";
import { getCategories, getTags } from "@/lib/categoryService";
import { subscribeToEventGroups, createEventGroup, addContributionsToGroup } from "@/lib/eventGroupService";
import { subscribeToEvents, createEvent } from "@/lib/eventService";
import { useAuth } from "@/contexts/AuthContext";
import { CategoryConflictModal } from "@/components/ui/CategoryConflictModal";
import { checkCategoryConflict, getEffectiveCategoryId } from "@/lib/categoryConflictUtils";
import { updateContributionByChronicler } from "@/lib/contributionService";
import type { Category, Tag, EventGroup, ChronicleEvent } from "@/types/contribution";

type ContribFilter = "all" | "pending" | "processed";
type EventAssignmentFilter = "all" | "in-events" | "not-in-events";
type OrgTab = "groups" | "events";
type SortKey = "date-desc" | "date-asc" | "contributor-asc" | "contributor-desc";

function ChroniclerContent() {
  const { appUser } = useAuth();
  const router = useRouter();
  const { contributions, loading } = useAllContributions();
  const [contribFilter, setContribFilter] = useState<ContribFilter>("pending");
  const [orgTab, setOrgTab] = useState<OrgTab>("groups");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<EventGroup[]>([]);
  const [events, setEvents] = useState<ChronicleEvent[]>([]);

  // ── Filter & sort state ───────────────────────────────────────────────────
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterContributors, setFilterContributors] = useState<Set<string>>(new Set());
  const [filterGroups, setFilterGroups] = useState<Set<string>>(new Set());
  const [filterEvents, setFilterEvents] = useState<Set<string>>(new Set());
  const [filterEventAssignment, setFilterEventAssignment] = useState<EventAssignmentFilter>("all");
  const [filterEventCategories, setFilterEventCategories] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");

  // Selection mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Category conflict modal (for merge)
  const [mergeConflictOpen, setMergeConflictOpen] = useState(false);
  const [pendingMergeConflict, setPendingMergeConflict] = useState<{
    dominantCategoryId: string;
    compatible: string[];
    conflicting: string[];
    afterResolve: (finalIds: string[]) => Promise<void>;
  } | null>(null);

  // Merge-into-group modal
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTab, setMergeTab] = useState<"new" | "existing">("new");
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const groupTitleRef = useRef<HTMLInputElement>(null);

  // Create-event modal
  const [eventOpen, setEventOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventCategoryId, setEventCategoryId] = useState<string | null>(null);
  const [eventSourceIds, setEventSourceIds] = useState<string[]>([]);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const eventTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCategories().then(setCategories);
    getTags().then(setTags);
    const unsubGroups = subscribeToEventGroups(setGroups);
    const unsubEvents = subscribeToEvents(setEvents);
    return () => { unsubGroups(); unsubEvents(); };
  }, []);

  const pendingCount = contributions.filter((c) => c.status === "pending").length;

  // Unique contributors derived from all contributions
  const allContributors = useMemo(() => {
    const map = new Map<string, string>();
    contributions.forEach((c) => map.set(c.contributorId, c.contributorName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "sk"));
  }, [contributions]);

  // Map: contributionId → eventIds it belongs to
  const contribEventMap = useMemo(() => {
    const map = new Map<string, string[]>();
    events.forEach((ev) => {
      ev.contributionIds.forEach((cid) => {
        const existing = map.get(cid) ?? [];
        map.set(cid, [...existing, ev.id]);
      });
    });
    return map;
  }, [events]);

  // Active filter count (for badge)
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterDateFrom || filterDateTo) n++;
    if (filterContributors.size > 0) n++;
    if (filterGroups.size > 0) n++;
    if (filterEvents.size > 0) n++;
    if (filterEventAssignment !== "all") n++;
    if (filterEventCategories.size > 0) n++;
    return n;
  }, [filterDateFrom, filterDateTo, filterContributors, filterGroups, filterEvents, filterEventAssignment, filterEventCategories]);

  function clearFilters() {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterContributors(new Set());
    setFilterGroups(new Set());
    setFilterEvents(new Set());
    setFilterEventAssignment("all");
    setFilterEventCategories(new Set());
  }

  function toggleSet<T>(prev: Set<T>, value: T): Set<T> {
    const next = new Set(prev);
    next.has(value) ? next.delete(value) : next.add(value);
    return next;
  }

  const displayed = useMemo(() => {
    let list = contributions.filter((c) => {
      if (contribFilter === "pending") return c.status === "pending";
      if (contribFilter === "processed") return c.status === "processed";
      return true;
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.texts.some((t) => t.toLowerCase().includes(q)) ||
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

    if (filterContributors.size > 0) {
      list = list.filter((c) => filterContributors.has(c.contributorId));
    }

    if (filterGroups.size > 0) {
      list = list.filter((c) => c.eventGroupIds.some((gid) => filterGroups.has(gid)));
    }

    if (filterEvents.size > 0) {
      list = list.filter((c) => (contribEventMap.get(c.id) ?? []).some((eid) => filterEvents.has(eid)));
    }

    if (filterEventAssignment === "in-events") {
      list = list.filter((c) => (contribEventMap.get(c.id) ?? []).length > 0);
    } else if (filterEventAssignment === "not-in-events") {
      list = list.filter((c) => (contribEventMap.get(c.id) ?? []).length === 0);
    }

    if (filterEventCategories.size > 0) {
      const matchingEventIds = new Set(
        events
          .filter((ev) => ev.categoryId && filterEventCategories.has(ev.categoryId))
          .map((ev) => ev.id)
      );
      list = list.filter((c) =>
        (contribEventMap.get(c.id) ?? []).some((eid) => matchingEventIds.has(eid))
      );
    }

    list = [...list].sort((a, b) => {
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
  }, [contributions, contribFilter, search, filterDateFrom, filterDateTo, filterContributors, filterGroups, filterEvents, filterEventAssignment, filterEventCategories, sortKey, contribEventMap, events]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  // ── Merge into group ──────────────────────────────────────────────────────
  function openMergeModal() {
    setMergeTab(groups.length > 0 ? "existing" : "new");
    setNewGroupTitle("");
    setTargetGroupId(groups[0]?.id ?? null);
    setMergeOpen(true);
    setTimeout(() => groupTitleRef.current?.focus(), 50);
  }

  async function doMerge(ids: string[]) {
    if (!appUser) return;
    setMerging(true);
    if (mergeTab === "new") {
      await createEventGroup(newGroupTitle.trim() || "Nová skupina", ids, appUser.uid);
    } else if (targetGroupId) {
      await addContributionsToGroup(targetGroupId, ids);
    }
    setMerging(false);
    setMergeOpen(false);
    exitSelectMode();
    setOrgTab("groups");
  }

  async function handleMerge() {
    if (!appUser) return;
    const ids = Array.from(selectedIds);
    const existingIds = mergeTab === "existing" && targetGroupId
      ? (groups.find((g) => g.id === targetGroupId)?.contributionIds ?? [])
      : [];
    const conflict = checkCategoryConflict(ids, existingIds, contributions);
    if (conflict.hasConflict && conflict.dominantCategoryId) {
      setMergeOpen(false);
      setPendingMergeConflict({
        dominantCategoryId: conflict.dominantCategoryId,
        compatible: conflict.compatible,
        conflicting: conflict.conflicting,
        afterResolve: doMerge,
      });
      setMergeConflictOpen(true);
    } else {
      await doMerge(ids);
    }
  }

  // ── Create event ─────────────────────────────────────────────────────────
  function openCreateEventModal(sourceIds: string[]) {
    setEventSourceIds(sourceIds);
    setEventTitle("");
    setEventCategoryId(getEffectiveCategoryId(sourceIds, contributions));
    setEventOpen(true);
    setTimeout(() => eventTitleRef.current?.focus(), 50);
  }

  async function handleCreateEvent() {
    if (!appUser || !eventTitle.trim() || !eventCategoryId) return;
    setCreatingEvent(true);
    const eventId = await createEvent({
      title: eventTitle.trim(),
      contributionIds: eventSourceIds,
      categoryId: eventCategoryId,
      createdBy: appUser.uid,
    });
    setCreatingEvent(false);
    setEventOpen(false);
    exitSelectMode();
    router.push(`/chronicler/events/${eventId}`);
  }

  // ── Contribution filter tabs ──────────────────────────────────────────────
  const CONTRIB_TABS: { key: ContribFilter; label: string }[] = [
    { key: "pending", label: "Čakajúce" },
    { key: "all", label: "Všetky" },
    { key: "processed", label: "Spracované" },
  ];

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "date-desc", label: "Dátum ↓" },
    { key: "date-asc", label: "Dátum ↑" },
    { key: "contributor-asc", label: "Prispievateľ A–Z" },
    { key: "contributor-desc", label: "Prispievateľ Z–A" },
  ];

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-6 pb-28 space-y-8">

        {/* ── CONTRIBUTIONS SECTION ─────────────────────────────────────── */}
        <section>
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-ink">Príspevky</h1>
              {pendingCount > 0 && (
                <p className="text-xs text-warning mt-0.5">
                  {pendingCount} {pendingCount === 1 ? "príspevok čaká" : pendingCount < 5 ? "príspevky čakajú" : "príspevkov čaká"} na spracovanie
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!selectMode ? (
                <button
                  onClick={() => setSelectMode(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-rim px-3 py-1.5 text-xs font-medium text-ink-dim hover:bg-surface hover:text-ink"
                >
                  <SelectIcon /> Vybrať
                </button>
              ) : (
                <button
                  onClick={exitSelectMode}
                  className="rounded-lg border border-rim px-3 py-1.5 text-xs font-medium text-ink-dim hover:bg-surface hover:text-ink"
                >
                  Zrušiť výber
                </button>
              )}
              <Link
                href="/chronicler/categories"
                className="rounded-lg border border-rim px-3 py-1.5 text-xs font-medium text-ink-dim hover:bg-surface hover:text-ink"
              >
                Kategórie
              </Link>
            </div>
          </div>

          {/* Search row */}
          <div className="mb-2 flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Hľadať v príspevkoch…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-rim bg-surface pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </div>
            {/* Filter button */}
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`relative flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                filterOpen || activeFilterCount > 0
                  ? "border-gold bg-gold-dim text-gold"
                  : "border-rim bg-surface text-ink-dim hover:text-ink"
              }`}
            >
              <FilterIcon />
              Filtre
              {activeFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-gold-text">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Sort row */}
          <div className="mb-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-ink-subtle shrink-0">Zoradiť:</span>
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
            <div className="mb-4 rounded-xl border border-rim bg-surface p-4 space-y-4">

              {/* Date range */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Dátum udalosti</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] text-ink-subtle mb-1">Od</label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-rim bg-canvas px-2 py-1.5 text-xs text-ink focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-ink-subtle mb-1">Do</label>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full rounded-lg border border-rim bg-canvas px-2 py-1.5 text-xs text-ink focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                    />
                  </div>
                </div>
              </div>

              {/* Contributors */}
              {allContributors.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Prispievateľ</p>
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

              {/* Groups */}
              {groups.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Zaradenie v skupine</p>
                  <div className="flex flex-wrap gap-1.5">
                    {groups.map((g) => {
                      const active = filterGroups.has(g.id);
                      return (
                        <button
                          key={g.id}
                          onClick={() => setFilterGroups((prev) => toggleSet(prev, g.id))}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                            active ? "border-gold bg-gold-dim text-gold" : "border-rim text-ink-dim hover:text-ink"
                          }`}
                        >
                          {active && <CheckSmallIcon />}
                          {g.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Events */}
              {events.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Konkrétna udalosť</p>
                  <div className="flex flex-wrap gap-1.5">
                    {events.map((ev) => {
                      const active = filterEvents.has(ev.id);
                      return (
                        <button
                          key={ev.id}
                          onClick={() => setFilterEvents((prev) => toggleSet(prev, ev.id))}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                            active ? "border-gold bg-gold-dim text-gold" : "border-rim text-ink-dim hover:text-ink"
                          }`}
                        >
                          {active && <CheckSmallIcon />}
                          {ev.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Event assignment */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Zaradenie v udalosti</p>
                <div className="flex gap-1.5 flex-wrap">
                  {([
                    { key: "all" as EventAssignmentFilter, label: "Všetky" },
                    { key: "in-events" as EventAssignmentFilter, label: "Zaradené" },
                    { key: "not-in-events" as EventAssignmentFilter, label: "Nezaradené" },
                  ]).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setFilterEventAssignment(key)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                        filterEventAssignment === key
                          ? "border-gold bg-gold-dim text-gold"
                          : "border-rim text-ink-dim hover:text-ink"
                      }`}
                    >
                      {filterEventAssignment === key && <CheckSmallIcon />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Event category multiselect */}
              {categories.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Kategória udalosti</p>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((cat) => {
                      const active = filterEventCategories.has(cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setFilterEventCategories((prev) => toggleSet(prev, cat.id))}
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            active
                              ? "border-transparent text-gold-text"
                              : "border-rim text-ink-dim hover:text-ink"
                          }`}
                          style={active ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                        >
                          {active && <CheckSmallIcon />}
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Clear filters */}
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-danger hover:underline"
                >
                  Zmazať všetky filtre
                </button>
              )}
            </div>
          )}

          {/* Contribution tabs */}
          <div className="mb-4 flex rounded-xl border border-rim bg-surface p-1 gap-0.5">
            {CONTRIB_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setContribFilter(key)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                  contribFilter === key
                    ? "bg-gold text-gold-text shadow-sm"
                    : "text-ink-dim hover:text-ink"
                }`}
              >
                {label}
                {key === "pending" && pendingCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-gold-text">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Contribution list */}
          {loading ? (
            <PageSpinner />
          ) : displayed.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-subtle">
              {activeFilterCount > 0 ? "Žiadne príspevky nezodpovedajú filtrom." : "Žiadne príspevky."}
            </div>
          ) : (
            <div className="space-y-3">
              {displayed.map((c) => (
                <ContributionCard
                  key={c.id}
                  contribution={c}
                  href={`/chronicler/${c.id}`}
                  categories={categories}
                  tags={tags}
                  selectable={selectMode}
                  selected={selectedIds.has(c.id)}
                  onSelect={() => toggleSelect(c.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── SKUPINY & UDALOSTI SECTION ────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-ink">Organizácia</h2>

          {/* Sub-tabs */}
          <div className="mb-4 flex rounded-xl border border-rim bg-surface p-1 gap-0.5">
            {([
              { key: "groups" as OrgTab, label: "Skupiny", count: groups.length },
              { key: "events" as OrgTab, label: "Udalosti", count: events.length },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setOrgTab(key)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                  orgTab === key
                    ? "bg-gold text-gold-text shadow-sm"
                    : "text-ink-dim hover:text-ink"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-dim px-1 text-[10px] font-bold text-gold">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Groups */}
          {orgTab === "groups" && (
            loading ? (
              <PageSpinner />
            ) : groups.length === 0 ? (
              <div className="py-12 text-center space-y-1.5">
                <p className="text-sm text-ink-subtle">Žiadne skupiny.</p>
                <p className="text-xs text-ink-subtle">Vyberte príspevky tlačidlom „Vybrať" a zlúčte ich.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((g) => (
                  <EventGroupCard
                    key={g.id}
                    group={g}
                    contributions={contributions}
                    events={events}
                    categories={categories}
                    onCreateEvent={(ids) => openCreateEventModal(ids)}
                  />
                ))}
              </div>
            )
          )}

          {/* Events */}
          {orgTab === "events" && (
            loading ? (
              <PageSpinner />
            ) : events.length === 0 ? (
              <div className="py-12 text-center space-y-1.5">
                <p className="text-sm text-ink-subtle">Žiadne udalosti.</p>
                <p className="text-xs text-ink-subtle">Vyberte príspevky alebo skupinu a vytvorte udalosť.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((ev) => (
                  <EventCard key={ev.id} event={ev} contributions={contributions} categories={categories} />
                ))}
              </div>
            )
          )}
        </section>
      </main>

      {/* Selection action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-rim bg-surface-high px-4 py-3">
          <div className="mx-auto max-w-2xl space-y-2">
            <p className="text-xs font-medium text-ink-dim text-center">
              {selectedIds.size}{" "}
              {selectedIds.size === 1 ? "príspevok" : selectedIds.size < 5 ? "príspevky" : "príspevkov"}{" "}
              vybraných
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="flex-1" onClick={openMergeModal} disabled={selectedIds.size < 2}>
                <GroupIcon /> Zlúčiť do skupiny
              </Button>
              <Button size="sm" className="flex-1" onClick={() => openCreateEventModal(Array.from(selectedIds))}>
                <CalendarIcon /> Vytvoriť udalosť
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Merge into group modal */}
      <Modal
        open={mergeOpen}
        title={`Zlúčiť ${selectedIds.size} príspevky do skupiny`}
        onClose={() => setMergeOpen(false)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setMergeOpen(false)}>Zrušiť</Button>
            <Button size="sm" loading={merging} disabled={mergeTab === "new" ? !newGroupTitle.trim() : !targetGroupId} onClick={handleMerge}>
              {mergeTab === "new" ? "Vytvoriť skupinu" : "Pridať do skupiny"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex rounded-xl border border-rim bg-canvas p-1">
            <button onClick={() => setMergeTab("new")} className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${mergeTab === "new" ? "bg-surface-high text-ink" : "text-ink-dim hover:text-ink"}`}>
              Nová skupina
            </button>
            <button onClick={() => setMergeTab("existing")} disabled={groups.length === 0} className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${mergeTab === "existing" ? "bg-surface-high text-ink" : "text-ink-dim hover:text-ink"}`}>
              Existujúca skupina
            </button>
          </div>
          {mergeTab === "new" ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-dim">Názov skupiny</label>
              <input
                ref={groupTitleRef}
                value={newGroupTitle}
                onChange={(e) => setNewGroupTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newGroupTitle.trim()) handleMerge(); }}
                placeholder="napr. Letný tábor 2025"
                className="w-full rounded-xl border border-rim bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-dim">Vyber skupinu</label>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {groups.map((g) => (
                  <label key={g.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${targetGroupId === g.id ? "border-gold bg-gold-dim" : "border-rim hover:bg-surface-high"}`}>
                    <input type="radio" name="group" value={g.id} checked={targetGroupId === g.id} onChange={() => setTargetGroupId(g.id)} className="sr-only" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{g.title}</p>
                      <p className="text-xs text-ink-subtle">{g.contributionIds.length} príspevkov</p>
                    </div>
                    {targetGroupId === g.id && (
                      <svg className="h-4 w-4 text-gold shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Create event modal */}
      <Modal
        open={eventOpen}
        title={`Vytvoriť udalosť z ${eventSourceIds.length} príspevkov`}
        onClose={() => setEventOpen(false)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEventOpen(false)}>Zrušiť</Button>
            <Button size="sm" loading={creatingEvent} disabled={!eventTitle.trim() || !eventCategoryId} onClick={handleCreateEvent}>
              Vytvoriť udalosť
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-dim">
            Aplikácia zostaví súhrn všetkých textov a fotografií z vybraných príspevkov.
            Potom môžete doplniť miesto, dátumy a popis.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-dim">Názov udalosti <span className="text-danger">*</span></label>
            <input
              ref={eventTitleRef}
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && eventTitle.trim() && eventCategoryId) handleCreateEvent(); }}
              placeholder="napr. Letný tábor 2025"
              className="w-full rounded-xl border border-rim bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-dim">Kategória <span className="text-danger">*</span></label>
            {categories.length === 0 ? (
              <p className="text-xs text-ink-subtle">Najprv vytvorte kategórie v sekcii Kategórie.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setEventCategoryId(eventCategoryId === cat.id ? null : cat.id)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-colors border ${
                      eventCategoryId === cat.id
                        ? "border-transparent text-gold-text"
                        : "bg-transparent text-ink-dim border-rim hover:border-rim-strong"
                    }`}
                    style={eventCategoryId === cat.id ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Category conflict modal (merge) */}
      {pendingMergeConflict && (
        <CategoryConflictModal
          open={mergeConflictOpen}
          dominantCategoryName={
            categories.find((c) => c.id === pendingMergeConflict.dominantCategoryId)?.name ??
            pendingMergeConflict.dominantCategoryId
          }
          compatibleCount={pendingMergeConflict.compatible.length}
          conflictingCount={pendingMergeConflict.conflicting.length}
          onChangeCategory={async () => {
            await Promise.all(
              pendingMergeConflict.conflicting.map((id) =>
                updateContributionByChronicler(id, {
                  categories: [pendingMergeConflict.dominantCategoryId],
                })
              )
            );
            await pendingMergeConflict.afterResolve([
              ...pendingMergeConflict.compatible,
              ...pendingMergeConflict.conflicting,
            ]);
            setMergeConflictOpen(false);
            setPendingMergeConflict(null);
          }}
          onSkipConflicting={async () => {
            await pendingMergeConflict.afterResolve(pendingMergeConflict.compatible);
            setMergeConflictOpen(false);
            setPendingMergeConflict(null);
          }}
          onCancel={() => {
            setMergeConflictOpen(false);
            setPendingMergeConflict(null);
          }}
        />
      )}
    </>
  );
}

export default function ChroniclerPage() {
  return <RouteGuard requiredRole="chronicler"><ChroniclerContent /></RouteGuard>;
}

function SelectIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="5" width="6" height="6" rx="1" />
      <path d="M3 17h2M7 17h2M13 5h8M13 12h8M13 19h8" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
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
