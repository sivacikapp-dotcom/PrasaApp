"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { PageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { getCategories } from "@/lib/categoryService";
import { getEvents, getEventsForUser } from "@/lib/eventService";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import type { ChronicleEvent, Group } from "@/types/contribution";
import type { Locale as DateFnsLocale } from "date-fns";

function EventsContent() {
  const { appUser } = useAuth();
  const { t, dateFnsLocale } = useI18n();
  const { prefs } = useUserPreferences();
  const ep = prefs.events;
  const [events, setEvents] = useState<ChronicleEvent[]>([]);
  const [categories, setCategories] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!appUser) return;
    async function load() {
      const allCats = await getCategories();
      const allowed = allCats.filter((c) => c.allowedUserIds.includes(appUser!.uid));
      setCategories(allCats);
      const isPrivileged = appUser!.roles.includes("chronicler") || appUser!.roles.includes("admin");
      const evts = isPrivileged
        ? await getEvents()
        : await getEventsForUser(allowed.map((c) => c.id), appUser!.uid);
      setEvents(evts);
      setLoading(false);
    }
    load();
  }, [appUser]);

  const filteredEvents = search.trim()
    ? events.filter((ev) => {
        const q = search.toLowerCase();
        return ev.title.toLowerCase().includes(q) || (ev.description ?? "").toLowerCase().includes(q) || (ev.locationName ?? "").toLowerCase().includes(q);
      })
    : events;

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const aDate = a.dateFrom ?? a.createdAt;
    const bDate = b.dateFrom ?? b.createdAt;
    const diff = aDate.getTime() - bDate.getTime();
    return ep.defaultSort === "asc" ? diff : -diff;
  });

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-6 pb-24 space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="flex-1 text-lg font-semibold text-ink">{t.events.title}</h1>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder={t.events.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-52 rounded-xl border border-rim bg-surface pl-9 pr-3 py-1.5 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>
        </div>

        {loading ? (
          <PageSpinner />
        ) : sortedEvents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
              <CalendarIcon className="h-7 w-7 text-ink-subtle" />
            </div>
            {search.trim() ? (
              <p className="text-sm text-ink-dim">{t.chronicler.noMatchFilters}</p>
            ) : (
              <>
                <p className="text-sm text-ink-dim">{t.events.empty}</p>
                <p className="text-xs text-ink-subtle">{t.events.noAccess}</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedEvents.map((ev) => {
              const cat = categories.find((c) => c.id === ev.categoryId);
              const dateLabel = buildDateLabel(ev, dateFnsLocale);
              return (
                <div
                  key={ev.id}
                  className="rounded-xl border border-rim bg-surface hover:border-gold hover:shadow-sm transition-all overflow-hidden"
                >
                  <Link href={`/events/${ev.id}`} className="block p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-ink flex-1 min-w-0 truncate">{ev.title}</p>
                      {cat && (
                        <span
                          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium text-gold-text"
                          style={{ backgroundColor: cat.color }}
                        >
                          {cat.icon ? cat.icon + " " + cat.name : cat.name}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {ep.showLocation && ev.locationName && (
                        <span className="flex items-center gap-1 text-xs text-ink-subtle">
                          <PinIcon /> {ev.locationName}
                        </span>
                      )}
                      {dateLabel && (
                        <span className="text-xs text-ink-subtle">{dateLabel}</span>
                      )}
                      {ep.showLastModified && (
                        <span className="text-xs text-ink-subtle">
                          {format(ev.updatedAt, "d. M. yyyy", { locale: dateFnsLocale })}
                        </span>
                      )}
                    </div>

                    {ev.description && (
                      <p className="mt-1.5 text-xs text-ink-dim line-clamp-2">{ev.description}</p>
                    )}
                  </Link>

                  <div className="flex items-center gap-2 px-4 pb-3">
                    {ep.showContributionCount && (
                      <span className="rounded-full bg-surface-high px-2 py-0.5 text-[10px] text-ink-subtle">
                        {t.events.contributionCount(ev.contributionIds.length)}
                      </span>
                    )}
                    <Link
                      href={`/events/${ev.id}/trasa`}
                      className="ml-auto flex items-center gap-1 text-[11px] font-medium hover:underline"
                      style={{ color: "#D4A843" }}
                    >
                      <RouteSmallIcon />
                      {t.trasa.viewTrasa}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function buildDateLabel(ev: ChronicleEvent, locale: DateFnsLocale): string | null {
  if (ev.dateFrom && ev.dateTo) {
    return `${format(ev.dateFrom, "d. M.", { locale })} – ${format(ev.dateTo, "d. M. yyyy", { locale })}`;
  }
  if (ev.dateFrom) return format(ev.dateFrom, "d. M. yyyy", { locale });
  if (ev.dateTo) return format(ev.dateTo, "d. M. yyyy", { locale });
  return null;
}

export default function EventsPage() {
  return (
    <RouteGuard>
      <EventsContent />
    </RouteGuard>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function RouteSmallIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 10h11a4 4 0 0 1 0 8h-1M3 10l4-4M3 10l4 4" />
      <circle cx="19" cy="6" r="2" />
    </svg>
  );
}
