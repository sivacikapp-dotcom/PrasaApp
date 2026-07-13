"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, type Locale } from "date-fns";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { PageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import Link from "next/link";
import { getEvent } from "@/lib/eventService";
import { getContribution, getContributionsByDirectEvent } from "@/lib/contributionService";
import { getCategories } from "@/lib/categoryService";
import { getAllUsers } from "@/lib/userService";
import { MediaLightbox, type LightboxItem } from "@/components/ui/MediaLightbox";
import type { ChronicleEvent, Contribution, Group } from "@/types/contribution";
import type { AppUser } from "@/types/user";

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
    const videos = [...c.chroniclerVideoUrls, ...c.videoUrls];
    for (const type of ENTITY_TYPE_ORDER) {
      if (type === "text" && c.texts.length > 0) all.push({ key: `${c.id}:text`, type, contribution: c });
      else if (type === "voiceUrl" && c.voices.length > 0) all.push({ key: `${c.id}:voiceUrl`, type, contribution: c });
      else if (type === "chroniclerText" && c.chroniclerText) all.push({ key: `${c.id}:chroniclerText`, type, contribution: c });
      else if (type === "chroniclerVoiceUrl" && (c.chroniclerVoiceUrl || c.chroniclerVoiceTranscript)) all.push({ key: `${c.id}:chroniclerVoiceUrl`, type, contribution: c });
      else if (type === "photos" && (photos.length > 0 || videos.length > 0)) all.push({ key: `${c.id}:photos`, type, contribution: c });
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
  const { t, dateFnsLocale } = useI18n();
  const router = useRouter();

  const [event, setEvent] = useState<ChronicleEvent | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [category, setCategory] = useState<Group | null>(null);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  useEffect(() => {
    if (!appUser) return;
    async function load() {
      try {
        const [ev, allCats, users] = await Promise.all([getEvent(id), getCategories(), getAllUsers()]);
        setAllUsers(users);
        if (!ev) { setLoading(false); return; }

        const isPrivileged = appUser!.roles.includes("chronicler") || appUser!.roles.includes("admin");

        if (ev.type === "direct") {
          const hasAccess =
            isPrivileged ||
            ev.allowedContributorIds.includes(appUser!.uid) ||
            (ev.editorIds ?? []).includes(appUser!.uid);
          if (!hasAccess) {
            setDenied(true);
            setLoading(false);
            return;
          }
        } else if (ev.categoryId) {
          const cat = allCats.find((c) => c.id === ev.categoryId);
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
        const [fetched, directFetched] = await Promise.all([
          Promise.all(ev.contributionIds.map((cid) => getContribution(cid).catch(() => null))),
          ev.type === "direct" ? getContributionsByDirectEvent(ev.id).catch(() => []) : Promise.resolve([]),
        ]);
        const merged = new Map<string, Contribution>();
        fetched.filter((c): c is Contribution => c !== null).forEach((c) => merged.set(c.id, c));
        directFetched.forEach((c) => merged.set(c.id, c));
        setContributions(Array.from(merged.values()));
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
            {denied ? t.eventDetail.accessDenied : t.eventDetail.notFound}
          </p>
          <button onClick={() => router.push("/events")} className="text-sm text-gold hover:underline">
            {t.eventDetail.backToEvents}
          </button>
        </div>
      </>
    );
  }

  const hiddenSet = new Set(event.hiddenItems);
  const allEntities = buildEntities(contributions, event.entityOrder ?? []);
  const visibleEntities = allEntities.filter((e) => !hiddenSet.has(e.key));
  const dateLabel = buildDateLabel(event, dateFnsLocale);
  const isPrivileged = appUser!.roles.includes("chronicler") || appUser!.roles.includes("admin");
  const canContribute = event.type === "direct" && (isPrivileged || event.allowedContributorIds.includes(appUser!.uid));

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
                <EditSmallIcon /> {t.eventDetail.editEvent}
              </Link>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              {event.type === "direct" && (
                <span className="rounded-full bg-gold-dim px-2 py-0.5 text-[10px] font-medium text-gold">
                  {t.eventDetail.directBadge}
                </span>
              )}
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
          {canContribute && (
            <Link
              href={`/dashboard/new?directEventId=${id}`}
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-gold px-2.5 py-1.5 text-xs font-medium text-gold-text transition-opacity hover:opacity-90"
            >
              <PlusSmallIcon />
              <span className="hidden sm:inline">{t.eventDetail.contributeBtn}</span>
            </Link>
          )}
          <Link
            href={`/events/${id}/trasa`}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-gold/20"
            style={{ borderColor: "#D4A843", color: "#D4A843" }}
            title={t.trasa.viewTrasa}
          >
            <RouteSmallIcon />
            <span className="hidden sm:inline">{t.trasa.viewTrasa}</span>
          </Link>
        </div>

        {/* Description */}
        {event.description && (
          <p className="text-sm text-ink-dim leading-relaxed">{event.description}</p>
        )}

        {/* Tagged participants */}
        <TaggedParticipants contributions={contributions} allUsers={allUsers} heading={t.eventDetail.taggedParticipants} />

        {/* Entity narrative */}
        {visibleEntities.length === 0 ? (
          <div className="rounded-xl border border-rim py-12 text-center">
            <p className="text-sm text-ink-subtle">{t.eventDetail.noContent}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleEntities.map(({ key, type, contribution: c }) => {
              if (type === "text") {
                return (
                  <div key={key} className="space-y-1.5">
                    {c.texts.map((text, ti) => (
                      <p key={ti} className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{text}</p>
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
                const videos = [...c.chroniclerVideoUrls, ...c.videoUrls];
                const media: LightboxItem[] = [
                  ...photos.map((url): LightboxItem => ({ url, type: "photo" })),
                  ...videos.map((url): LightboxItem => ({ url, type: "video" })),
                ];
                return (
                  <div key={key} className={`grid gap-1.5 ${media.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
                    {media.map((item, mi) => (
                      <button
                        key={item.url}
                        type="button"
                        onClick={() => setLightbox({ items: media, index: mi })}
                        className="relative aspect-square rounded-lg overflow-hidden bg-surface-high"
                      >
                        {item.type === "photo" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.url} alt="" className="absolute inset-0 h-full w-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <>
                            <video src={item.url} preload="metadata" muted playsInline
                              className="absolute inset-0 h-full w-full object-cover" />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <PlaySmallIcon />
                            </span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}
      </main>

      {lightbox && (
        <MediaLightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndexChange={(i) => setLightbox((prev) => (prev ? { ...prev, index: i } : prev))}
        />
      )}
    </>
  );
}

// ── Tagged participants block ──────────────────────────────────────────────────

function TaggedParticipants({
  contributions,
  allUsers,
  heading,
}: {
  contributions: Contribution[];
  allUsers: AppUser[];
  heading: string;
}) {
  const taggedUidSet = new Set(contributions.flatMap((c) => c.taggedUserIds ?? []));
  const taggedUsers = allUsers.filter((u) => taggedUidSet.has(u.uid));
  if (taggedUsers.length === 0) return null;

  return (
    <div className="rounded-xl border border-rim bg-surface px-4 py-3 space-y-2.5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{heading}</h2>
      <div className="flex flex-wrap gap-2">
        {taggedUsers.map((u) => (
          <UserChip key={u.uid} user={u} />
        ))}
      </div>
    </div>
  );
}

function UserChip({ user }: { user: AppUser }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-rim bg-surface-high pl-0.5 pr-2.5 py-0.5">
      {user.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.photoURL}
          alt={user.displayName}
          width={22}
          height={22}
          referrerPolicy="no-referrer"
          className="rounded-full object-cover shrink-0"
          style={{ width: 22, height: 22 }}
        />
      ) : (
        <span className="w-[22px] h-[22px] rounded-full bg-surface border border-rim flex items-center justify-center text-[9px] font-medium text-ink-subtle shrink-0">
          {user.displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
        </span>
      )}
      <span className="text-xs text-ink">{user.displayName}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function buildDateLabel(ev: ChronicleEvent, locale: Locale): string | null {
  if (ev.dateFrom && ev.dateTo) {
    return `${format(ev.dateFrom, "d. M.", { locale })} – ${format(ev.dateTo, "d. M. yyyy", { locale })}`;
  }
  if (ev.dateFrom) return format(ev.dateFrom, "d. M. yyyy", { locale });
  if (ev.dateTo) return format(ev.dateTo, "d. M. yyyy", { locale });
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

function PlusSmallIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
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

function PlaySmallIcon() {
  return (
    <svg className="h-8 w-8 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
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
