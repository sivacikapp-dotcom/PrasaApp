"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/contexts/I18nContext";
import { ConfirmModal } from "@/components/ui/Modal";
import { ContributionPickerModal } from "@/components/ui/ContributionPickerModal";
import { GroupConflictModal } from "@/components/ui/GroupConflictModal";
import {
  renameEventGroup,
  removeContributionFromGroup,
  addContributionsToGroup,
  deleteEventGroup,
} from "@/lib/eventGroupService";
import { updateContributionByChronicler } from "@/lib/contributionService";
import { checkCategoryConflict, getEffectiveCategoryId } from "@/lib/categoryConflictUtils";
import type { EventGroup, Contribution, ChronicleEvent, Group } from "@/types/contribution";

interface EventGroupCardProps {
  group: EventGroup;
  contributions: Contribution[];
  events?: ChronicleEvent[];
  categories?: Group[];
  onCreateEvent: (contributionIds: string[]) => void;
}

export function EventGroupCard({ group, contributions, events = [], categories = [], onCreateEvent }: EventGroupCardProps) {
  const { t, dateFnsLocale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(group.title);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [pendingConflict, setPendingConflict] = useState<{
    dominantCategoryId: string;
    compatible: string[];
    conflicting: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const members = contributions.filter((c) => group.contributionIds.includes(c.id));

  const effectiveCategoryId = getEffectiveCategoryId(group.contributionIds, members);
  const effectiveCategory = effectiveCategoryId
    ? categories.find((c) => c.id === effectiveCategoryId) ?? null
    : null;

  async function handleRename() {
    if (!newTitle.trim() || newTitle === group.title) {
      setRenaming(false);
      return;
    }
    setSaving(true);
    await renameEventGroup(group.id, newTitle.trim());
    setSaving(false);
    setRenaming(false);
  }

  async function handleRemoveMember(contributionId: string) {
    await removeContributionFromGroup(group.id, contributionId);
  }

  async function handleDelete() {
    setDeleting(true);
    await deleteEventGroup(group.id);
  }

  function startRename() {
    setNewTitle(group.title);
    setRenaming(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  // Find events that contain any contribution from this group
  const linkedEvents = events.filter((ev) =>
    group.contributionIds.some((cid) => ev.contributionIds.includes(cid))
  );

  return (
    <div className="rounded-xl border border-rim bg-surface shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0"
          aria-label={expanded ? t.eventGroupCard.collapse : t.eventGroupCard.expand}
        >
          <ChevronIcon expanded={expanded} />
        </button>

        {renaming ? (
          <input
            ref={inputRef}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="flex-1 min-w-0 rounded-lg border border-gold bg-surface-high px-2 py-0.5 text-sm text-ink focus:outline-none"
          />
        ) : (
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-ink truncate block">{group.title}</span>
            {linkedEvents.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {linkedEvents.map((ev) => (
                  <Link
                    key={ev.id}
                    href={`/chronicler/events/${ev.id}`}
                    className="flex items-center gap-1 text-[10px] text-gold hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <CalendarMiniIcon />
                    {ev.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <span className="shrink-0 rounded-full bg-gold-dim px-2 py-0.5 text-xs font-medium text-gold">
          {group.contributionIds.length}
        </span>

        {effectiveCategory ? (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-gold-text"
            style={{ backgroundColor: effectiveCategory.color }}
          >
            {effectiveCategory.name}
          </span>
        ) : null}

        {renaming ? (
          <Button size="sm" loading={saving} onClick={handleRename}>
            OK
          </Button>
        ) : (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={startRename}
              className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-high hover:text-ink"
              title={t.eventGroupCard.rename}
            >
              <PenIcon />
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-high hover:text-ink"
              title={t.eventGroupCard.addContribs}
            >
              <PlusIcon />
            </button>
            <button
              onClick={() => onCreateEvent(group.contributionIds)}
              disabled={group.contributionIds.length === 0}
              className="rounded-lg p-1.5 text-ink-subtle hover:bg-gold-dim hover:text-gold disabled:opacity-30"
              title={t.eventGroupCard.createEvent}
            >
              <EventIcon />
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              disabled={deleting}
              className="rounded-lg p-1.5 text-ink-subtle hover:bg-danger-dim hover:text-danger disabled:opacity-40"
              title={t.eventGroupCard.deleteGroup}
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      {/* Members */}
      {expanded && (
        <div className="border-t border-rim divide-y divide-rim">
          {members.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-subtle">{t.eventGroupCard.emptyGroup}</p>
          ) : (
            members.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-high"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gold">
                    {format(c.verifiedEventDate ?? c.eventDate, "d. M. yyyy", { locale: dateFnsLocale })}
                  </p>
                  <p className="text-sm text-ink truncate">{c.texts[0] || t.eventGroupCard.noText}</p>
                  <p className="text-xs text-ink-subtle">{c.contributorName}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href={`/chronicler/${c.id}`}
                    className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface hover:text-ink"
                    title={t.eventGroupCard.openContrib}
                  >
                    <ExternalIcon />
                  </Link>
                  <button
                    onClick={() => handleRemoveMember(c.id)}
                    className="rounded-lg p-1.5 text-ink-subtle hover:bg-danger-dim hover:text-danger"
                    title={t.eventGroupCard.removeFromGroup}
                  >
                    <UnlinkIcon />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <ConfirmModal
        open={deleteOpen}
        title={t.eventGroupCard.deleteTitle}
        message={t.eventGroupCard.deleteMessage(group.title)}
        confirmLabel={t.eventGroupCard.deleteConfirm}
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
      />

      <ContributionPickerModal
        open={addOpen}
        title={t.eventGroupCard.addContribsModalTitle(group.title)}
        alreadyIncluded={group.contributionIds}
        onConfirm={async (ids, selectedContribs) => {
          const allContribs = [...contributions, ...selectedContribs];
          const conflict = checkCategoryConflict(ids, group.contributionIds, allContribs);
          if (conflict.hasConflict && conflict.dominantCategoryId) {
            setPendingConflict({
              dominantCategoryId: conflict.dominantCategoryId,
              compatible: conflict.compatible,
              conflicting: conflict.conflicting,
            });
            setConflictOpen(true);
          } else {
            await addContributionsToGroup(group.id, ids);
          }
        }}
        onClose={() => setAddOpen(false)}
      />

      {pendingConflict && (
        <GroupConflictModal
          open={conflictOpen}
          dominantCategoryName={
            categories.find((c) => c.id === pendingConflict.dominantCategoryId)?.name ??
            pendingConflict.dominantCategoryId
          }
          compatibleCount={pendingConflict.compatible.length}
          conflictingCount={pendingConflict.conflicting.length}
          onChangeCategory={async () => {
            await Promise.all(
              pendingConflict.conflicting.map((id) =>
                updateContributionByChronicler(id, {
                  categories: [pendingConflict.dominantCategoryId],
                })
              )
            );
            await addContributionsToGroup(group.id, [
              ...pendingConflict.compatible,
              ...pendingConflict.conflicting,
            ]);
            setConflictOpen(false);
            setPendingConflict(null);
          }}
          onSkipConflicting={() => {
            if (pendingConflict.compatible.length > 0) {
              addContributionsToGroup(group.id, pendingConflict.compatible);
            }
            setConflictOpen(false);
            setPendingConflict(null);
          }}
          onCancel={() => {
            setConflictOpen(false);
            setPendingConflict(null);
          }}
        />
      )}
    </div>
  );
}

function CalendarMiniIcon() {
  return (
    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-ink-subtle transition-transform ${expanded ? "rotate-90" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function EventIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
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

function ExternalIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function UnlinkIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
