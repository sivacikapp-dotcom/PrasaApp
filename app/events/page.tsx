"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { PageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { getCategories } from "@/lib/categoryService";
import { getEventsForUser } from "@/lib/eventService";
import type { ChronicleEvent, Category } from "@/types/contribution";

function EventsContent() {
  const { appUser } = useAuth();
  const [events, setEvents] = useState<ChronicleEvent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    async function load() {
      const allCats = await getCategories();
      const allowed = allCats.filter((c) => c.allowedUserIds.includes(appUser!.uid));
      setCategories(allCats);
      const evts = await getEventsForUser(allowed.map((c) => c.id), appUser!.uid);
      setEvents(evts);
      setLoading(false);
    }
    load();
  }, [appUser]);

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-6 pb-24 space-y-4">
        <h1 className="text-lg font-semibold text-ink">Udalosti</h1>

        {loading ? (
          <PageSpinner />
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
              <CalendarIcon className="h-7 w-7 text-ink-subtle" />
            </div>
            <p className="text-sm text-ink-dim">Žiadne dostupné udalosti.</p>
            <p className="text-xs text-ink-subtle">Kronikár vám musí najprv sprístupniť kategóriu.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => {
              const cat = categories.find((c) => c.id === ev.categoryId);
              const dateLabel = buildDateLabel(ev);
              return (
                <Link
                  key={ev.id}
                  href={`/events/${ev.id}`}
                  className="block rounded-xl border border-rim bg-surface p-4 hover:border-gold hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-ink flex-1 min-w-0 truncate">{ev.title}</p>
                    {cat && (
                      <span
                        className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium text-gold-text"
                        style={{ backgroundColor: cat.color }}
                      >
                        {cat.name}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    {ev.locationName && (
                      <span className="flex items-center gap-1 text-xs text-ink-subtle">
                        <PinIcon /> {ev.locationName}
                      </span>
                    )}
                    {dateLabel && (
                      <span className="text-xs text-ink-subtle">{dateLabel}</span>
                    )}
                  </div>

                  {ev.description && (
                    <p className="mt-1.5 text-xs text-ink-dim line-clamp-2">{ev.description}</p>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-full bg-surface-high px-2 py-0.5 text-[10px] text-ink-subtle">
                      {ev.contributionIds.length} príspevkov
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function buildDateLabel(ev: ChronicleEvent): string | null {
  if (ev.dateFrom && ev.dateTo) {
    return `${format(ev.dateFrom, "d. M.", { locale: sk })} – ${format(ev.dateTo, "d. M. yyyy", { locale: sk })}`;
  }
  if (ev.dateFrom) return format(ev.dateFrom, "d. M. yyyy", { locale: sk });
  if (ev.dateTo) return format(ev.dateTo, "d. M. yyyy", { locale: sk });
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
