"use client";

import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { ConfirmModal } from "@/components/ui/Modal";
import { deleteEvent } from "@/lib/eventService";
import type { ChronicleEvent, Contribution, Category } from "@/types/contribution";

interface EventCardProps {
  event: ChronicleEvent;
  contributions: Contribution[];
  categories?: Category[];
}

export function EventCard({ event, contributions, categories = [] }: EventCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const members = contributions.filter((c) => event.contributionIds.includes(c.id));
  const eventCategory = categories.find((c) => c.id === event.categoryId) ?? null;

  // Photo count from all included contributions
  const photoCount = members.reduce((sum, c) => sum + c.photoUrls.length, 0);

  const dateLabel = buildDateLabel(event, members);

  async function handleDelete() {
    setDeleting(true);
    await deleteEvent(event.id);
  }

  return (
    <div className="rounded-xl border border-rim bg-surface shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Left: event icon */}
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-dim text-gold">
          <CalendarIcon />
        </div>

        {/* Center: info */}
        <Link href={`/chronicler/events/${event.id}`} className="flex-1 min-w-0 hover:opacity-80">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-ink truncate flex-1">{event.title}</p>
            {eventCategory && (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium text-gold-text"
                style={{ backgroundColor: eventCategory.color }}
              >
                {eventCategory.name}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {event.locationName && (
              <span className="flex items-center gap-1 text-xs text-ink-subtle">
                <PinIcon /> {event.locationName}
              </span>
            )}
            {dateLabel && (
              <span className="text-xs text-ink-subtle">{dateLabel}</span>
            )}
          </div>
          {event.description && (
            <p className="mt-1 text-xs text-ink-dim line-clamp-2">{event.description}</p>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            <Chip label={`${event.contributionIds.length} príspevkov`} />
            {photoCount > 0 && <Chip label={`${photoCount} fotografií`} />}
          </div>
        </Link>

        {/* Right: actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Link
            href={`/chronicler/events/${event.id}`}
            className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-high hover:text-ink"
            title="Upraviť udalosť"
          >
            <EditIcon />
          </Link>
          <button
            onClick={() => setDeleteOpen(true)}
            disabled={deleting}
            className="rounded-lg p-1.5 text-ink-subtle hover:bg-danger-dim hover:text-danger disabled:opacity-40"
            title="Odstrániť udalosť"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <ConfirmModal
        open={deleteOpen}
        title="Odstrániť udalosť"
        message={`Naozaj odstrániť udalosť „${event.title}"? Príspevky zostanú zachované.`}
        confirmLabel="Odstrániť udalosť"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}

function buildDateLabel(event: ChronicleEvent, members: Contribution[]): string | null {
  if (event.dateFrom || event.dateTo) {
    if (event.dateFrom && event.dateTo) {
      return `${format(event.dateFrom, "d. M.", { locale: sk })} – ${format(event.dateTo, "d. M. yyyy", { locale: sk })}`;
    }
    if (event.dateFrom) return format(event.dateFrom, "d. M. yyyy", { locale: sk });
    if (event.dateTo) return format(event.dateTo, "d. M. yyyy", { locale: sk });
  }
  if (members.length === 0) return null;
  const dates = members
    .map((c) => c.verifiedEventDate ?? c.eventDate)
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 1) return format(dates[0], "d. M. yyyy", { locale: sk });
  return `${format(dates[0], "d. M.", { locale: sk })} – ${format(dates[dates.length - 1], "d. M. yyyy", { locale: sk })}`;
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-surface-high px-2 py-0.5 text-[10px] text-ink-subtle">
      {label}
    </span>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
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

function EditIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  );
}
