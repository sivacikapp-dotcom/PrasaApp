"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/contexts/I18nContext";
import type { Contribution, Group, Tag } from "@/types/contribution";
import type { ContributionListPrefs } from "@/types/userPreferences";

const SHOW_ALL: ContributionListPrefs = {
  defaultSort: "desc",
  showLocation: true,
  showContributor: true,
  showContentTypes: true,
  showPhotoPreview: true,
  showTaggedUsers: "yes",
};

interface ContributionCardProps {
  contribution: Contribution;
  href: string;
  categories?: Group[];
  tags?: Tag[];
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  displayPrefs?: ContributionListPrefs;
  currentUserId?: string;
  submittedAgoLabel?: string;
}

export function ContributionCard({
  contribution, href, categories = [], tags = [],
  selectable = false, selected = false, onSelect,
  displayPrefs = SHOW_ALL, currentUserId, submittedAgoLabel,
}: ContributionCardProps) {
  const { t, dateFnsLocale } = useI18n();
  const c = contribution;
  const displayDate = c.verifiedEventDate ?? c.eventDate;
  const catMap = Object.fromEntries(categories.map((cat) => [cat.id, cat]));
  const tagMap = Object.fromEntries(tags.map((tg) => [tg.id, tg]));
  const allPhotos = [...c.photoUrls, ...c.chroniclerPhotoUrls];

  const showTaggedBadge = (() => {
    if (displayPrefs.showTaggedUsers === "no" || c.taggedUserIds.length === 0) return false;
    if (displayPrefs.showTaggedUsers === "only_me") return currentUserId ? c.taggedUserIds.includes(currentUserId) : false;
    return true;
  })();

  const inner = (
    <article className={`rounded-xl border bg-surface p-4 shadow-sm transition-colors space-y-3 active:scale-[0.98] ${
      selectable
        ? selected
          ? "border-gold bg-gold-dim"
          : "border-rim hover:border-rim-strong hover:bg-surface-high cursor-pointer"
        : "border-rim hover:border-rim-strong hover:bg-surface-high"
    }`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            {selectable && (
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                selected ? "border-gold bg-gold" : "border-rim-strong bg-surface"
              }`}>
                {selected && (
                  <svg className="h-2.5 w-2.5 text-gold-text" viewBox="0 0 10 10" fill="currentColor">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </span>
            )}
            <div>
              <p className="text-xs font-medium text-gold uppercase tracking-wide">
                {format(displayDate, "d. MMMM yyyy", { locale: dateFnsLocale })}
              </p>
              {displayPrefs.showContributor && (
                <p className="text-xs text-ink-subtle mt-0.5">{c.contributorName}</p>
              )}
              {submittedAgoLabel && (
                <p className="text-[10px] text-ink-subtle/60 mt-0.5">{submittedAgoLabel}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {c.eventGroupIds.length > 0 && !selectable && (
              <span title={t.components.partOfGroup}>
                <LinkIcon />
              </span>
            )}
            <Badge color={c.status === "processed" ? "green" : "amber"}>
              {c.status === "processed" ? t.components.statusProcessed : t.components.statusPending}
            </Badge>
          </div>
        </div>

        {/* Text */}
        {c.texts[0] && (
          <p className="text-sm text-ink line-clamp-3">{c.texts[0]}</p>
        )}
        {c.chroniclerText && (
          <p className="text-sm text-gold/80 line-clamp-2 border-l-2 border-gold/40 pl-2">
            {c.chroniclerText}
          </p>
        )}

        {/* Photos */}
        {displayPrefs.showPhotoPreview && allPhotos.length > 0 && (
          <div className="flex gap-1.5 overflow-hidden">
            {allPhotos.slice(0, 4).map((url, i) => (
              <div key={url} className="relative h-16 w-16 shrink-0 rounded-md overflow-hidden bg-surface-high">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                {i === 3 && allPhotos.length > 4 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-ink text-sm font-medium">
                    +{allPhotos.length - 4}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer: icons + categories/tags */}
        <div className="flex items-center gap-3 flex-wrap">
          {displayPrefs.showContentTypes && (c.voices.length > 0 || c.chroniclerVoiceUrl) && (
            <span className="flex items-center gap-1 text-xs text-ink-subtle">
              <MicIcon /> {t.components.voice}
            </span>
          )}
          {displayPrefs.showContentTypes && c.videoUrls?.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-ink-subtle">
              <VideoIcon />{" "}
              {c.videoUrls.length > 1
                ? t.components.videoCount(c.videoUrls.length)
                : t.components.video}
            </span>
          )}
          {displayPrefs.showLocation && c.location && (
            <span className="flex items-center gap-1 text-xs text-ink-subtle">
              <PinIcon /> {c.locationName ?? `${c.location.latitude.toFixed(4)}, ${c.location.longitude.toFixed(4)}`}
            </span>
          )}
          {showTaggedBadge && (
            <span className="flex items-center gap-1 text-xs text-ink-subtle">
              <UsersIcon />
              {displayPrefs.showTaggedUsers === "only_me"
                ? t.taggedUsers.displayLabel
                : `${t.taggedUsers.displayLabel} (${c.taggedUserIds.length})`}
            </span>
          )}
          {c.categories.map((id) =>
            catMap[id] ? (
              <span
                key={id}
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: catMap[id].color + "33", color: catMap[id].color }}
              >
                {catMap[id].name}
              </span>
            ) : null
          )}
          {c.hashtags.map((id) =>
            tagMap[id] ? (
              <span key={id} className="text-xs text-gold/70">{tagMap[id].name}</span>
            ) : null
          )}
        </div>
      </article>
  );

  if (selectable) {
    return <div onClick={onSelect}>{inner}</div>;
  }
  return <Link href={href}>{inner}</Link>;
}

function LinkIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-gold/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
