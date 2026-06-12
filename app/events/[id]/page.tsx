"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { PageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { getEvent } from "@/lib/eventService";
import { getContribution } from "@/lib/contributionService";
import { getCategories } from "@/lib/categoryService";
import type { ChronicleEvent, Contribution, Group } from "@/types/contribution";

// ── Entity model (mirrors chronicler editor) ──────────────────────────────────

type EntityType =
  | "text"
  | "voiceUrl"
  | "chroniclerText"
  | "chroniclerVoiceUrl"
  | "photos";

const ENTITY_TYPE_ORDER: EntityType[] = [
  "text",
  "voiceUrl",
  "chroniclerText",
  "chroniclerVoiceUrl",
  "photos",
];

interface Entity {
  key: string;
  type: EntityType;
  contribution: Contribution;
}

function buildEntities(contributions: Contribution[], entityOrder: string[]): Entity[] {
  const dateSorted = [...contributions].sort(
    (a, b) =>
      (a.verifiedEventDate ?? a.eventDate).getTime() -
      (b.verifiedEventDate ?? b.eventDate).getTime()
  );
  const all: Entity[] = [];
  for (const c of dateSorted) {
    const photos = [...c.chroniclerPhotoUrls, ...c.photoUrls];
    for (const type of ENTITY_TYPE_ORDER) {
      if (type === "text" && c.texts.length > 0) all.push({ key: `${c.id}:text`, type, contribution: c });
      else if (type === "voiceUrl" && c.voices.length > 0) all.push({ key: `${c.id}:voiceUrl`, type, contribution: c });
      else if (type === "chroniclerText" && c.chroniclerText) all.push({ key: `${c.id}:chroniclerText`, type, contribution: c });
      else if (type === "chroniclerVoiceUrl" && (c.chroniclerVoiceUrl || c.chroniclerVoiceTranscript)) all.push({ key: `${c.id}:chroniclerVoiceUrl`, type, contribution: c });
      else if (type === "photos" && photos.length > 0) all.push({ key: `${c.id}:photos`, type, contribution: c });
    }
  }
  if (entityOrder.length === 0) return all;
  const map = new Map(all.map((e) => [e.key, e]));
  const ordered = entityOrder.flatMap((k) => (map.has(k) ? [map.get(k)!] : []));
  all.forEach((e) => { if (!entityOrder.includes(e.key)) ordered.push(e); });
  return ordered;
}

// ── Page ──────────────────────────────────────────────────────────────────────

function EventDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { appUser } = useAuth();
  const router = useRouter();

  const [event, setEvent] = useState<ChronicleEvent | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [category, setCategory] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!appUser) return;
    async function load() {
      try {
        const [ev, allCats] = await Promise.all([getEvent(id), getCategories()]);
        if (!ev) { setLoading(false); return; }

        if (ev.categoryId) {
          const cat = allCats.find((c) => c.id === ev.categoryId);
          const isPrivileged = appUser!.roles.includes("chronicler") || appUser!.roles.includes("admin");
          const hasAccess =
            isPrivileged ||
            (cat && cat.allowedUserIds.includes(appUser!.uid)) ||
            (ev.editorIds ?? []).includes(appUser!.uid);
          if (!hasAccess) {
            setDenied(true);
            setLoading(false);
            return;
          }
          setCategory(cat ?? null);
        }

        setEvent(ev);
        const fetched = await Promise.all(
          ev.contributionIds.map((cid) =>
            getContribution(cid).catch(() => null)
          )
        );
        setContributions(fetched.filter((c): c is Contribution => c !== null));
      } catch {
        // silently handle unexpected errors
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, appUser]);

  if (loading) return <><NavBar /><PageSpinner /></>;

  if (denied || !event) {
    return (
      <>
        <NavBar />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-2">
          <p className="text-sm font-medium text-ink-dim">
            {denied ? "Nemáte prístup k tejto udalosti." : "Udalosť neexistuje."}
          </p>
          <button onClick={() => router.push("/events")} className="text-sm text-gold hover:underline">
            Späť na udalosti
          </button>
        </div>
      </>
    );
  }

  const hiddenSet = new Set(event.hiddenItems);
  const allEntities = buildEntities(contributions, event.entityOrder ?? []);
  const visibleEntities = allEntities.filter((e) => !hiddenSet.has(e.key));
  const dateLabel = buildDateLabel(event);

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-6 pb-16 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="rounded-lg p-1.5 text-ink-subtle hover:text-ink">
            <BackIcon />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-ink truncate">{event.title}</h1>
            {(event.editorIds ?? []).includes(appUser!.uid) && (
              <Link
                href={`/events/${id}/edit`}
                className="mt-0.5 inline-flex items-center gap-1 text-xs text-gold hover:underline"
              >
                <EditSmallIcon /> Upraviť udalosť
              </Link>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              {category && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-gold-text" style={{ backgroundColor: category.color }}>
                  {category.icon ? category.icon + " " + category.name : category.name}
                </span>
              )}
              {event.locationName && (
                <span className="flex items-center gap-1 text-xs text-ink-subtle">
                  <PinIcon /> {event.locationName}
                </span>
              )}
              {dateLabel && <span className="text-xs text-ink-subtle">{dateLabel}</span>}
            </div>
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <p className="text-sm text-ink-dim leading-relaxed">{event.description}</p>
        )}

        {/* Entity narrative */}
        {visibleEntities.length === 0 ? (
          <div className="rounded-xl border border-rim py-12 text-center">
            <p className="text-sm text-ink-subtle">Udalosť zatiaľ neobsahuje obsah.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleEntities.map(({ key, type, contribution: c }) => {
              if (type === "text") {
                return (
                  <div key={key} className="space-y-1.5">
                    {c.texts.map((t, ti) => (
                      <p key={ti} className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{t}</p>
                    ))}
                  </div>
                );
              }
              if (type === "voiceUrl") {
                const audioHidden = hiddenSet.has(`${key}:audio`);
                const transcriptHidden = hiddenSet.has(`${key}:transcript`);
                return (
                  <div key={key} className="space-y-2">
                    {c.voices.map((v) => (
                      <div key={v.url} className="space-y-1">
                        {!audioHidden && <audio src={v.url} controls className="w-full h-8" />}
                        {!transcriptHidden && v.transcript && (
                          <p className="text-xs text-ink-dim italic leading-relaxed">{v.transcript}</p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }
              if (type === "chroniclerText") {
                return (
                  <p key={key} className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                    {c.chroniclerText}
                  </p>
                );
              }
              if (type === "chroniclerVoiceUrl") {
                const audioHidden = hiddenSet.has(`${key}:audio`);
                const transcriptHidden = hiddenSet.has(`${key}:transcript`);
                return (
                  <div key={key} className="space-y-1.5">
                    {!audioHidden && c.chroniclerVoiceUrl && <audio src={c.chroniclerVoiceUrl} controls className="w-full h-8" />}
                    {!transcriptHidden && c.chroniclerVoiceTranscript && (
                      <p className="text-xs text-ink-dim italic leading-relaxed">{c.chroniclerVoiceTranscript}</p>
                    )}
                  </div>
                );
              }
              if (type === "photos") {
                const photos = [...c.chroniclerPhotoUrls, ...c.photoUrls];
                return (
                  <div key={key} className={`grid gap-1.5 ${photos.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
                    {photos.map((url) => (
                      <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-surface-high">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                );
              }
              return null;
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

export default function EventDetailPage() {
  return (
    <RouteGuard>
      <EventDetailContent />
    </RouteGuard>
  );
}

function BackIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

function EditSmallIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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
