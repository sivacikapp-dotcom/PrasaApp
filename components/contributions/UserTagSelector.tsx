"use client";

import { useState } from "react";
import type { Group } from "@/types/contribution";
import type { AppUser } from "@/types/user";

interface UserTagSelectorProps {
  groups: Group[];
  selectedGroupIds: string[];
  allUsers: AppUser[];
  currentUserId: string;
  taggedUserIds: string[];
  onChange: (ids: string[]) => void;
  label: string;
  noUsersLabel: string;
}

export function UserTagSelector({
  groups,
  selectedGroupIds,
  allUsers,
  currentUserId,
  taggedUserIds,
  onChange,
  label,
  noUsersLabel,
}: UserTagSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedGroups = groups.filter((g) => selectedGroupIds.includes(g.id));

  const allowedUidSet = new Set(
    selectedGroups.flatMap((g) => g.allowedUserIds)
  );
  allowedUidSet.delete(currentUserId);

  const usersToShow = allUsers.filter(
    (u) => allowedUidSet.has(u.uid) && u.status === "active"
  );

  const taggedUsers = allUsers.filter((u) => taggedUserIds.includes(u.uid));

  function toggleUser(uid: string) {
    if (taggedUserIds.includes(uid)) {
      onChange(taggedUserIds.filter((id) => id !== uid));
    } else {
      onChange([...taggedUserIds, uid]);
    }
  }

  function removeTagged(uid: string) {
    onChange(taggedUserIds.filter((id) => id !== uid));
  }

  /** Groups from selectedGroups that contain this user. */
  function userGroups(uid: string): Group[] {
    return selectedGroups.filter((g) => g.allowedUserIds.includes(uid));
  }

  if (selectedGroupIds.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Header row — acts as toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-sm font-medium text-ink-dim hover:text-ink transition-colors"
      >
        <span>{label}{taggedUsers.length > 0 ? ` (${taggedUsers.length})` : ""}</span>
        <ChevronIcon open={open} />
      </button>

      {/* Tagged users chips — always visible */}
      {taggedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {taggedUsers.map((u) => (
            <span
              key={u.uid}
              className="flex items-center gap-1.5 rounded-full bg-gold-dim border border-gold/30 pl-1 pr-2 py-0.5 text-xs text-gold"
            >
              <UserAvatar user={u} size={16} />
              {u.displayName}
              <button
                type="button"
                onClick={() => removeTagged(u.uid)}
                className="opacity-60 hover:opacity-100 hover:text-danger transition-opacity"
                aria-label={`Odstrániť ${u.displayName}`}
              >
                <XMiniIcon />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Collapsible user list */}
      {open && (
        <div className="rounded-xl border border-rim bg-surface divide-y divide-rim overflow-hidden">
          {usersToShow.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-ink-subtle">{noUsersLabel}</p>
          ) : (
            usersToShow.map((u) => {
              const memberships = userGroups(u.uid);
              return (
                <label
                  key={u.uid}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer select-none hover:bg-surface-high transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={taggedUserIds.includes(u.uid)}
                    onChange={() => toggleUser(u.uid)}
                    className="h-4 w-4 rounded accent-gold shrink-0"
                  />
                  <UserAvatar user={u} size={28} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-ink leading-tight">{u.displayName}</span>
                    {memberships.length > 0 && (
                      <span className="flex flex-wrap gap-1 mt-0.5">
                        {memberships.map((g) => (
                          <span
                            key={g.id}
                            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-medium text-gold-text leading-tight"
                            style={{ backgroundColor: g.color }}
                          >
                            {g.icon && <span>{g.icon}</span>}
                            {g.name}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function UserAvatar({ user, size }: { user: AppUser; size: number }) {
  if (user.photoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.photoURL}
        alt={user.displayName}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = user.displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="rounded-full bg-surface-high border border-rim flex items-center justify-center text-ink-subtle font-medium shrink-0"
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.4) }}
    >
      {initials}
    </span>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function XMiniIcon() {
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <line x1="2" y1="2" x2="10" y2="10" />
      <line x1="10" y1="2" x2="2" y2="10" />
    </svg>
  );
}
