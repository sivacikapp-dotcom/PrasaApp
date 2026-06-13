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
import { useI18n } from "@/contexts/I18nContext";
import { GroupConflictModal } from "@/components/ui/GroupConflictModal";
import { EventGroupConflictModal } from "@/components/ui/EventGroupConflictModal";
import { checkCategoryConflict, getEffectiveCategoryId, checkEventGroupConflict } from "@/lib/categoryConflictUtils";
import { updateContributionByChronicler } from "@/lib/contributionService";
import type { Group, Tag, EventGroup, ChronicleEvent } from "@/types/contribution";

type PageTab = "prispevky" | "skupiny" | "udalosti";
type ContribFilter = "all" | "pending" | "processed";
type SortKey = "date-desc" | "date-asc" | "contributor-asc" | "contributor-desc";
type EventSortKey = "date-desc" | "date-asc" | "title-asc" | "title-desc";

const FILTER_STORAGE_KEY = "chronicler-filter-v1";

function ChroniclerContent() {
  const { appUser } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { contributions, loading } = useAllContributions();

  const [pageTab, setPageTab] = useState<PageTab>("prispevky");

  const [contribFilter, setContribFilter] = useState<ContribFilter>("pending");
  const [categories, setCategories] = useState<Group[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<EventGroup[]>([]);
  const [events, setEvents] = useState<ChronicleEvent[]>([]);

  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterContributors, setFilterContributors] = useState<Set<string>>(new Set());
  const [filterGroups, setFilterGroups] = useState<Set<string>>(new Set());
  const [filterEvents, setFilterEvents] = useState<Set<string>>(new Set());
  const [filterNotInEvents, setFilterNotInEvents] = useState(false);
  const [filterEventCategories, setFilterEventCategories] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");

  const [filterLoaded, setFilterLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Record<string, unknown>;
        if (s.contribFilter) setContribFilter(s.contribFilter as ContribFilter);
        if (typeof s.filterDateFrom === "string") setFilterDateFrom(s.filterDateFrom);
        if (typeof s.filterDateTo === "string") setFilterDateTo(s.filterDateTo);
        if (Array.isArray(s.filterContributors)) setFilterContributors(new Set(s.filterContributors as string[]));
        if (Array.isArray(s.filterGroups)) setFilterGroups(new Set(s.filterGroups as string[]));
        if (Array.isArray(s.filterEvents)) setFilterEvents(new Set(s.filterEvents as string[]));
        if (typeof s.filterNotInEvents === "boolean") setFilterNotInEvents(s.filterNotInEvents);
        if (Array.isArray(s.filterEventCategories)) setFilterEventCategories(new Set(s.filterEventCategories as string[]));
        if (s.sortKey) setSortKey(s.sortKey as SortKey);
        if (typeof s.search === "string") setSearch(s.search);
      }
    } catch { /* ignore */ }
    setFilterLoaded(true);
  }, []);

  useEffect(() => {
    if (!filterLoaded) return;
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
        contribFilter, filterDateFrom, filterDateTo,
        filterContributors: [...filterContributors],
        filterGroups: [...filterGroups],
        filterEvents: [...filterEvents],
        filterNotInEvents,
        filterEventCategories: [...filterEventCategories],
        sortKey, search,
      }));
    } catch { /* ignore */ }
  }, [filterLoaded, contribFilter, filterDateFrom, filterDateTo, filterContributors, filterGroups, filterEvents, filterNotInEvents, filterEventCategories, sortKey, search]);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [mergeConflictOpen, setMergeConflictOpen] = useState(false);
  const [pendingMergeConflict, setPendingMergeConflict] = useState<{
    dominantCategoryId: string;
    compatible: string[];
    conflicting: string[];
    afterResolve: (finalIds: string[]) => Promise<void>;
  } | null>(null);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTab, setMergeTab] = useState<"new" | "existing">("new");
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const groupTitleRef = useRef<HTMLInputElement>(null);

  const [eventOpen, setEventOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventCategoryId, setEventCategoryId] = useState<string | null>(null);
  const [eventSourceIds, setEventSourceIds] = useState<string[]>([]);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const eventTitleRef = useRef<HTMLInputElement>(null);

  const [addToGroupOpen, setAddToGroupOpen] = useState(false);
  const [addToEventOpen, setAddToEventOpen] = useState(false);
  const [pendingEventConflict, setPendingEventConflict] = useState<{
    event: ChronicleEvent;
    compatible: string[];
    conflicting: string[];
  } | null>(null);

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

  const allContributors = useMemo(() => {
    const map = new Map<string, string>();
    contributions.forEach((c) => map.set(c.contributorId, c.contributorName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "sk"));
  }, [contributions]);

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

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterDateFrom || filterDateTo) n++;
    if (filterContributors.size > 0) n++;
    if (filterGroups.size > 0) n++;
    if (filterEvents.size > 0 || filterNotInEvents) n++;
    if (filterEventCategories.size > 0) n++;
    return n;
  }, [filterDateFrom, filterDateTo, filterContributors, filterGroups, filterEvents, filterNotInEvents, filterEventCategories]);

  function clearFilters() {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterContributors(new Set());
    setFilterGroups(new Set());
    setFilterEvents(new Set());
    setFilterNotInEvents(false);
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

    if (filterContributors.size > 0) {
      list = list.filter((c) => filterContributors.has(c.contributorId));
    }

    if (filterGroups.size > 0) {
      list = list.filter((c) => c.eventGroupIds.some((gid) => filterGroups.has(gid)));
    }

    if (filterNotInEvents) {
      list = list.filter((c) => (contribEventMap.get(c.id) ?? []).length === 0);
    } else if (filterEvents.size > 0) {
      list = list.filter((c) => (contribEventMap.get(c.id) ?? []).some((eid) => filterEvents.has(eid)));
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
  }, [contributions, contribFilter, search, filterDateFrom, filterDateTo, filterContributors, filterGroups, filterEvents, filterNotInEvents, filterEventCategories, sortKey, contribEventMap, events]);

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
    setPageTab("skupiny");
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

  async function handleAddToGroup(group: EventGroup) {
    await addContributionsToGroup(group.id, Array.from(selectedIds));
    setAddToGroupOpen(false);
    exitSelectMode();
  }

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

  async function handleEventConflictOverwriteContribs() {
    if (!pendingEventConflict) return;
    const { event, compatible, conflicting } = pendingEventConflict;
    const eventCatId = event.categoryId!;
    const eventCat = categories.find((c) => c.id === eventCatId);
    await Promise.all(
      conflicting.map(async (cid) => {
        const c = contributions.find((x) => x.id === cid);
        if (!c) return;
        const newVisibleToIds = [c.contributorId, ...(eventCat?.allowedUserIds ?? [])].filter(
          (v, i, a) => a.indexOf(v) === i
        );
        await updateContributionByChronicler(cid, { categories: [eventCatId], visibleToIds: newVisibleToIds });
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

  const CONTRIB_TABS: { key: ContribFilter; label: string }[] = [
    { key: "pending", label: t.chronicler.filterTabPending },
    { key: "all", label: t.chronicler.filterTabAll },
    { key: "processed", label: t.chronicler.filterTabProcessed },
  ];

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "date-desc", label: t.chronicler.sortDateDesc },
    { key: "date-asc", label: t.chronicler.sortDateAsc },
    { key: "contributor-asc", label: t.chronicler.sortContributorAsc },
    { key: "contributor-desc", label: t.chronicler.sortContributorDesc },
  ];

  const EVENT_SORT_OPTIONS: { key: EventSortKey; label: string }[] = [
    { key: "date-desc", label: t.chronicler.eventSortDateDesc },
    { key: "date-asc", label: t.chronicler.eventSortDateAsc },
    { key: "title-asc", label: t.chronicler.eventSortTitleAsc },
    { key: "title-desc", label: t.chronicler.eventSortTitleDesc },
  ];

  return (
    <>
      <NavBar />

      {/* ── Main page tabs ──────────────────────────────────────────────── */}
      <div className="sticky top-[57px] z-30 bg-canvas/95 backdrop-blur-sm border-b border-rim">
        <div className="mx-auto max-w-2xl px-4 flex gap-0.5 py-2">
          {([
            { key: "prispevky" as PageTab, label: t.chronicler.tabContributions, badge: pendingCount > 0 ? pendingCount : undefined },
            { key: "skupiny" as PageTab, label: t.chronicler.tabGroups, badge: groups.length > 0 ? groups.length : undefined },
            { key: "udalosti" as PageTab, label: t.chronicler.tabEvents, badge: events.length > 0 ? events.length : undefined },
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

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-ink">{t.chronicler.contributionsHeading}</h1>
              {pendingCount > 0 && (
                <p className="text-xs text-warning mt-0.5">
                  {t.chronicler.pendingWarning(pendingCount)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!selectMode ? (
                <button
                  onClick={() => setSelectMode(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-rim px-3 py-1.5 text-xs font-medium text-ink-dim hover:bg-surface hover:text-ink"
                >
                  <SelectIcon /> {t.chronicler.selectBtn}
                </button>
              ) : (
                <button
                  onClick={exitSelectMode}
                  className="rounded-lg border border-rim px-3 py-1.5 text-xs font-medium text-ink-dim hover:bg-surface hover:text-ink"
                >
                  {t.chronicler.cancelSelectBtn}
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
                placeholder={t.chronicler.searchPlaceholder}
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
              {t.chronicler.filtersBtn}
              {activeFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-gold-text">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Sort row */}
          <div className="mb-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-ink-subtle shrink-0">{t.chronicler.sortLabel}</span>
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

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.chronicler.filterDateRange}</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] text-ink-subtle mb-1">{t.chronicler.filterFrom}</label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-rim bg-canvas px-2 py-1.5 text-xs text-ink focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-ink-subtle mb-1">{t.chronicler.filterTo}</label>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full rounded-lg border border-rim bg-canvas px-2 py-1.5 text-xs text-ink focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                    />
                  </div>
                </div>
              </div>

              {allContributors.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.chronicler.filterContributor}</p>
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

              {groups.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.chronicler.filterMerge}</p>
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

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.chronicler.filterEventLabel}</p>
                <div className="flex flex-wrap gap-1.5">
                  {events.map((ev) => {
                    const active = filterEvents.has(ev.id);
                    return (
                      <button
                        key={ev.id}
                        onClick={() => {
                          setFilterNotInEvents(false);
                          setFilterEvents((prev) => toggleSet(prev, ev.id));
                        }}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                          active ? "border-gold bg-gold-dim text-gold" : "border-rim text-ink-dim hover:text-ink"
                        }`}
                      >
                        {active && <CheckSmallIcon />}
                        {ev.title}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => {
                      setFilterEvents(new Set());
                      setFilterNotInEvents((prev) => !prev);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      filterNotInEvents ? "border-gold bg-gold-dim text-gold" : "border-rim text-ink-dim hover:text-ink"
                    }`}
                  >
                    {filterNotInEvents && <CheckSmallIcon />}
                    {t.chronicler.filterUnassigned}
                  </button>
                </div>
              </div>

              {categories.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.chronicler.filterGroupLabel}</p>
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
                          {cat.icon ? cat.icon + " " + cat.name : cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-danger hover:underline"
                >
                  {t.chronicler.clearFilters}
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

          {loading ? (
            <PageSpinner />
          ) : displayed.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-subtle">
              {activeFilterCount > 0 ? t.chronicler.noMatchFilters : t.chronicler.noContributions}
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
      </main>
      )}

      {/* ── Skupiny príspevkov tab ───────────────────────────────────────── */}
      {pageTab === "skupiny" && (
        <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
          {loading ? (
            <PageSpinner />
          ) : groups.length === 0 ? (
            <div className="py-12 text-center space-y-1.5">
              <p className="text-sm text-ink-subtle">{t.chronicler.noGroups}</p>
              <p className="text-xs text-ink-subtle">{t.chronicler.noGroupsHint}</p>
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
          )}
        </main>
      )}

      {/* ── Udalosti tab ────────────────────────────────────────────────── */}
      {pageTab === "udalosti" && (
        <main className="mx-auto max-w-2xl px-4 py-6 pb-16 space-y-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder={t.chronicler.searchEventsPlaceholder}
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
              className="w-full rounded-xl border border-rim bg-surface pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-ink-subtle shrink-0">{t.chronicler.sortLabel}</span>
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

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-ink-subtle shrink-0">{t.chronicler.eventFilterGroupLabel}</span>
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
                    {cat.icon ? cat.icon + " " + cat.name : cat.name}
                  </button>
                );
              })}
            </div>
          )}

          {loading ? (
            <PageSpinner />
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-subtle">
              {t.chronicler.noEventResults(events.length > 0)}
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
              {t.chronicler.selectedCount(selectedIds.size)}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={openMergeModal} disabled={selectedIds.size < 2}>
                <GroupIcon /> {t.chronicler.mergeGroupBtn}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setAddToGroupOpen(true)}>
                <FolderPlusIcon /> {t.chronicler.addToGroupBtn}
              </Button>
              <Button size="sm" onClick={() => openCreateEventModal(Array.from(selectedIds))}>
                <CalendarIcon /> {t.chronicler.createEventBtn}
              </Button>
              <Button size="sm" onClick={() => setAddToEventOpen(true)}>
                <CalendarCheckIcon /> {t.chronicler.addToEventBtn}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Merge into group modal */}
      <Modal
        open={mergeOpen}
        title={t.chronicler.mergeModalTitle(selectedIds.size)}
        onClose={() => setMergeOpen(false)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setMergeOpen(false)}>{t.chronicler.cancelBtn}</Button>
            <Button size="sm" loading={merging} disabled={mergeTab === "new" ? !newGroupTitle.trim() : !targetGroupId} onClick={handleMerge}>
              {mergeTab === "new" ? t.chronicler.mergeCreateBtn : t.chronicler.mergeAddBtn}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex rounded-xl border border-rim bg-canvas p-1">
            <button onClick={() => setMergeTab("new")} className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${mergeTab === "new" ? "bg-surface-high text-ink" : "text-ink-dim hover:text-ink"}`}>
              {t.chronicler.mergeTabNew}
            </button>
            <button onClick={() => setMergeTab("existing")} disabled={groups.length === 0} className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${mergeTab === "existing" ? "bg-surface-high text-ink" : "text-ink-dim hover:text-ink"}`}>
              {t.chronicler.mergeTabExisting}
            </button>
          </div>
          {mergeTab === "new" ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-dim">{t.chronicler.groupNameLabel}</label>
              <input
                ref={groupTitleRef}
                value={newGroupTitle}
                onChange={(e) => setNewGroupTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newGroupTitle.trim()) handleMerge(); }}
                placeholder={t.chronicler.groupNamePlaceholder}
                className="w-full rounded-xl border border-rim bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-dim">{t.chronicler.selectGroupLabel}</label>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {groups.map((g) => (
                  <label key={g.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${targetGroupId === g.id ? "border-gold bg-gold-dim" : "border-rim hover:bg-surface-high"}`}>
                    <input type="radio" name="group" value={g.id} checked={targetGroupId === g.id} onChange={() => setTargetGroupId(g.id)} className="sr-only" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{g.title}</p>
                      <p className="text-xs text-ink-subtle">{t.chronicler.contributionPluralCount(g.contributionIds.length)}</p>
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
        title={t.chronicler.createEventModalTitle(eventSourceIds.length)}
        onClose={() => setEventOpen(false)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEventOpen(false)}>{t.chronicler.cancelBtn}</Button>
            <Button size="sm" loading={creatingEvent} disabled={!eventTitle.trim() || !eventCategoryId} onClick={handleCreateEvent}>
              {t.chronicler.createEventSubmitBtn}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-dim">{t.chronicler.createEventDesc}</p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-dim">{t.chronicler.eventNameLabel} <span className="text-danger">*</span></label>
            <input
              ref={eventTitleRef}
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && eventTitle.trim() && eventCategoryId) handleCreateEvent(); }}
              placeholder={t.chronicler.eventNamePlaceholder}
              className="w-full rounded-xl border border-rim bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-dim">{t.chronicler.eventGroupLabel} <span className="text-danger">*</span></label>
            {categories.length === 0 ? (
              <p className="text-xs text-ink-subtle">{t.chronicler.noGroupsYet}</p>
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
                    {cat.icon ? cat.icon + " " + cat.name : cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <GroupPickerModal
        open={addToGroupOpen}
        onConfirm={handleAddToGroup}
        onClose={() => setAddToGroupOpen(false)}
      />

      <EventPickerModal
        open={addToEventOpen}
        onConfirm={handleAddToEvent}
        onClose={() => setAddToEventOpen(false)}
      />

      <EventGroupConflictModal
        open={pendingEventConflict !== null}
        mode="batch"
        eventGroupName={
          categories.find((c) => c.id === pendingEventConflict?.event.categoryId)?.name ??
          (pendingEventConflict?.event.categoryId ?? "")
        }
        conflictingCount={pendingEventConflict?.conflicting.length ?? 0}
        compatibleCount={pendingEventConflict?.compatible.length ?? 0}
        onOverwriteContrib={handleEventConflictOverwriteContribs}
        onAddCompatibleOnly={handleEventConflictCompatibleOnly}
        onCancel={() => setPendingEventConflict(null)}
      />

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
