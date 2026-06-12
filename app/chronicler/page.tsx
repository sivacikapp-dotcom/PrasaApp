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
import { subscribeToEvents, createEvent, addContributionsToEvent } from "@/lib/eventService";
import { EventPickerModal } from "@/components/ui/EventPickerModal";
import { GroupPickerModal } from "@/components/ui/GroupPickerModal";
import { useAuth } from "@/contexts/AuthContext";
import { GroupConflictModal } from "@/components/ui/GroupConflictModal";
import { EventGroupConflictModal } from "@/components/ui/EventGroupConflictModal";
import { checkCategoryConflict, getEffectiveCategoryId, checkEventGroupConflict } from "@/lib/categoryConflictUtils";
import { updateContributionByChronicler } from "@/lib/contributionService";
import type { Group, Tag, EventGroup, ChronicleEvent } from "@/types/contribution";

type PageTab = "prispevky" | "udalosti";
type ContribFilter = "all" | "pending" | "processed";
type EventAssignmentFilter = "all" | "in-events" | "not-in-events";
type OrgTab = "groups" | "events";
type SortKey = "date-desc" | "date-asc" | "contributor-asc" | "contributor-desc";
type EventSortKey = "date-desc" | "date-asc" | "title-asc" | "title-desc";

const FILTER_STORAGE_KEY = "chronicler-filter-v1";

function ChroniclerContent() {
  const { appUser } = useAuth();
  const router = useRouter();
  const { contributions, loading } = useAllContributions();

  // ── Page tab ──────────────────────────────────────────────────────────────
  const [pageTab, setPageTab] = useState<PageTab>("prispevky");

  const [contribFilter, setContribFilter] = useState<ContribFilter>("pending");
  const [orgTab, setOrgTab] = useState<OrgTab>("groups");
  const [categories, setCategories] = useState<Group[]>([]);
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

  // Track whether sessionStorage has been loaded (avoids saving defaults over stored values)
  const [filterLoaded, setFilterLoaded] = useState(false);

  // Restore filter from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Record<string, unknown>;
        if (s.contribFilter) setContribFilter(s.contribFilter as ContribFilter);
        if (s.orgTab) setOrgTab(s.orgTab as OrgTab);
        if (typeof s.filterDateFrom === "string") setFilterDateFrom(s.filterDateFrom);
        if (typeof s.filterDateTo === "string") setFilterDateTo(s.filterDateTo);
        if (Array.isArray(s.filterContributors)) setFilterContributors(new Set(s.filterContributors as string[]));
        if (Array.isArray(s.filterGroups)) setFilterGroups(new Set(s.filterGroups as string[]));
        if (Array.isArray(s.filterEvents)) setFilterEvents(new Set(s.filterEvents as string[]));
        if (s.filterEventAssignment) setFilterEventAssignment(s.filterEventAssignment as EventAssignmentFilter);
        if (Array.isArray(s.filterEventCategories)) setFilterEventCategories(new Set(s.filterEventCategories as string[]));
        if (s.sortKey) setSortKey(s.sortKey as SortKey);
        if (typeof s.search === "string") setSearch(s.search);
      }
    } catch { /* ignore */ }
    setFilterLoaded(true);
  }, []);

  // Persist filter to sessionStorage whenever it changes (only after initial load)
  useEffect(() => {
    if (!filterLoaded) return;
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
        contribFilter,
        orgTab,
        filterDateFrom,
        filterDateTo,
        filterContributors: [...filterContributors],
        filterGroups: [...filterGroups],
        filterEvents: [...filterEvents],
        filterEventAssignment,
        filterEventCategories: [...filterEventCategories],
        sortKey,
        search,
      }));
    } catch { /* ignore */ }
  }, [filterLoaded, contribFilter, orgTab, filterDateFrom, filterDateTo, filterContributors, filterGroups, filterEvents, filterEventAssignment, filterEventCategories, sortKey, search]);

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

  // Add-to-group / add-to-event modals
  const [addToGroupOpen, setAddToGroupOpen] = useState(false);
  const [addToEventOpen, setAddToEventOpen] = useState(false);
  const [pendingEventConflict, setPendingEventConflict] = useState<{
    event: ChronicleEvent;
    compatible: string[];
    conflicting: string[];
  } | null>(null);

  // ── Udalosti tab state ────────────────────────────────────────────────────
  const [eventSearch, setEventSearch] = useState("");
  const [eventSort, setEventSort] = useState<EventSortKey>("date-desc");
  const [eventFilterCatIds, setEventFilterCatIds] = useState<Set<string>>(new Set());

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

  const filteredEvents = useMemo(() => {
    let list = [...events];
    if (eventSearch.trim()) {
      const q = eventSearch.toLowerCase();
      list = list.filter((ev) => ev.title.toLowerCase().includes(q));
    }
    if (eventFilterCatIds.size > 0) {
      list = list.filter((ev) => ev.categoryId && eventFilterCatIds.has(ev.categoryId));
    }
    list.sort((a, b) => {
      if (eventSort === "title-asc") return a.title.localeCompare(b.title, "sk");
      if (eventSort === "title-desc") return b.title.localeCompare(a.title, "sk");
      const ta = (a.dateFrom ?? a.createdAt).getTime();
      const tb = (b.dateFrom ?? b.createdAt).getTime();
      return eventSort === "date-asc" ? ta - tb : tb - ta;
    });
    return list;
  }, [events, eventSearch, eventSort, eventFilterCatIds]);

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

  // ── Add to existing group ────────────────────────────────────────────────
  async function handleAddToGroup(group: EventGroup) {
    await addContributionsToGroup(group.id, Array.from(selectedIds));
    setAddToGroupOpen(false);
    exitSelectMode();
  }

  // ── Add to existing event ────────────────────────────────────────────────
  async function handleAddToEvent(ev: ChronicleEvent) {
    const ids = Array.from(selectedIds);
    const { compatible, conflicting } = checkEventGroupConflict(ids, ev.categoryId, contributions);
    if (conflicting.length > 0) {
      setAddToEventOpen(false);
      setPendingEventConflict({ event: ev, compatible, conflicting });
      return;
    }
    await addContributionsToEvent(ev.id, ids);
    setAddToEventOpen(false);
    exitSelectMode();
  }

  async function handleEventConflictAlign() {
    if (!pendingEventConflict) return;
    const { event, compatible, conflicting } = pendingEventConflict;
    const eventCatId = event.categoryId!;
    await Promise.all(
      conflicting.map(async (cid) => {
        const c = contributions.find((x) => x.id === cid);
        if (!c) return;
        const newCategories = [...new Set([...c.categories, eventCatId])];
        await updateContributionByChronicler(cid, { categories: newCategories });
      })
    );
    await addContributionsToEvent(event.id, [...compatible, ...conflicting]);
    setPendingEventConflict(null);
    exitSelectMode();
  }

  async function handleEventConflictCompatibleOnly() {
    if (!pendingEventConflict) return;
    const { event, compatible } = pendingEventConflict;
    if (compatible.length > 0) {
      await addContributionsToEvent(event.id, compatible);
    }
    setPendingEventConflict(null);
    exitSelectMode();
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

  const EVENT_SORT_OPTIONS: { key: EventSortKey; label: string }[] = [
    { key: "date-desc", label: "Dátum ↓" },
    { key: "date-asc", label: "Dátum ↑" },
    { key: "title-asc", label: "Názov A–Z" },
    { key: "title-desc", label: "Názov Z–A" },
  ];

  return (
    <>
      <NavBar />

      {/* ── Main page tabs ──────────────────────────────────────────────── */}
      <div className="sticky top-[57px] z-30 bg-canvas/95 backdrop-blur-sm border-b border-rim">
        <div className="mx-auto max-w-2xl px-4 flex gap-0.5 py-2">
          {([
            { key: "prispevky" as PageTab, label: "Príspevky", badge: pendingCount > 0 ? pendingCount : undefined },
            { key: "udalosti" as PageTab, label: "Udalosti", badge: events.length > 0 ? events.length : undefined },
          ]).map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setPageTab(key)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                pageTab === key
                  ? "bg-gold text-gold-text"
                  : "text-ink-dim hover:bg-surface hover:text-ink"
              }`}
            >
              {label}
              {badge !== undefined && (
                <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                  pageTab === key ? "bg-black/20 text-gold-text" : "bg-surface-high text-ink-subtle"
                }`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Príspevky tab ───────────────────────────────────────────────── */}
      {pageTab === "prispevky" && (
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
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Skupina udalosti</p>
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
      )} {/* end Príspevky tab */}

      {/* ── Udalosti tab ────────────────────────────────────────────────── */}
      {pageTab === "udalosti" && (
        <main className="mx-auto max-w-2xl px-4 py-6 pb-16 space-y-4">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Hľadať udalosti…"
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
              className="w-full rounded-xl border border-rim bg-surface pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-ink-subtle shrink-0">Zoradiť:</span>
            {EVENT_SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setEventSort(key)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                  eventSort === key ? "border-gold bg-gold-dim text-gold" : "border-rim text-ink-dim hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Filter by skupiny */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-ink-subtle shrink-0">Skupina:</span>
              {categories.map((cat) => {
                const active = eventFilterCatIds.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => setEventFilterCatIds((prev) => toggleSet(prev, cat.id))}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      active ? "border-transparent text-gold-text" : "border-rim text-ink-dim hover:text-ink"
                    }`}
                    style={active ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Event list */}
          {loading ? (
            <PageSpinner />
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-subtle">
              {events.length === 0 ? "Žiadne udalosti. Vytvorte ich z príspevkov." : "Žiadne udalosti nezodpovedajú filtrom."}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((ev) => (
                <EventCard key={ev.id} event={ev} contributions={contributions} categories={categories} />
              ))}
            </div>
          )}
        </main>
      )}

      {/* Selection action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-rim bg-surface-high px-4 py-3">
          <div className="mx-auto max-w-2xl space-y-2">
            <p className="text-xs font-medium text-ink-dim text-center">
              {selectedIds.size}{" "}
              {selectedIds.size === 1 ? "príspevok" : selectedIds.size < 5 ? "príspevky" : "príspevkov"}{" "}
              vybraných
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={openMergeModal} disabled={selectedIds.size < 2}>
                <GroupIcon /> Zlúčiť skupinu
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setAddToGroupOpen(true)}>
                <FolderPlusIcon /> Pridať do skupiny
              </Button>
              <Button size="sm" onClick={() => openCreateEventModal(Array.from(selectedIds))}>
                <CalendarIcon /> Vytvoriť udalosť
              </Button>
              <Button size="sm" onClick={() => setAddToEventOpen(true)}>
                <CalendarCheckIcon /> Vlož do udalosti
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
            <label className="text-xs font-medium text-ink-dim">Skupina <span className="text-danger">*</span></label>
            {categories.length === 0 ? (
              <p className="text-xs text-ink-subtle">Najprv vytvorte skupiny v sekcii Skupiny.</p>
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

      {/* Add to existing group modal */}
      <GroupPickerModal
        open={addToGroupOpen}
        onConfirm={handleAddToGroup}
        onClose={() => setAddToGroupOpen(false)}
      />

      {/* Add to existing event modal */}
      <EventPickerModal
        open={addToEventOpen}
        onConfirm={handleAddToEvent}
        onClose={() => setAddToEventOpen(false)}
      />

      {/* Event-group conflict modal */}
      <EventGroupConflictModal
        open={pendingEventConflict !== null}
        mode="batch"
        eventGroupName={
          categories.find((c) => c.id === pendingEventConflict?.event.categoryId)?.name ??
          (pendingEventConflict?.event.categoryId ?? "")
        }
        conflictingCount={pendingEventConflict?.conflicting.length ?? 0}
        compatibleCount={pendingEventConflict?.compatible.length ?? 0}
        onAlign={handleEventConflictAlign}
        onAddCompatibleOnly={handleEventConflictCompatibleOnly}
        onCancel={() => setPendingEventConflict(null)}
      />

      {/* Group conflict modal (merge) */}
      {pendingMergeConflict && (
        <GroupConflictModal
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

function FolderPlusIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

function CalendarCheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  );
}
