"use client";

import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";
import type { AppNotification } from "@/types/notification";

interface Props {
  notification: AppNotification;
  onRead: () => void;
  onClose: () => void;
}

function formatTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Práve teraz";
  if (minutes < 60) return `pred ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `pred ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `pred ${days} d`;
  return date.toLocaleDateString("sk-SK", { day: "numeric", month: "short" });
}

export function NotificationItem({ notification, onRead, onClose }: Props) {
  const { t } = useI18n();
  const { type, actorName, eventTitle, categoryName, extraUserName, actorPhotoURL, createdAt, read } = notification;

  const message = (() => {
    const m = t.notifications.messages;
    switch (type) {
      case "user_tagged":
        return m.user_tagged(actorName);
      case "contribution_added_to_event":
        return m.contribution_added_to_event(eventTitle ?? "");
      case "contribution_removed_from_event":
        return m.contribution_removed_from_event(eventTitle ?? "");
      case "contribution_deleted":
        return m.contribution_deleted(actorName);
      case "event_created":
        return m.event_created(eventTitle ?? "");
      case "user_added_to_group":
        return m.user_added_to_group(extraUserName ?? actorName, categoryName ?? "");
      case "user_removed_from_group":
        return m.user_removed_from_group(extraUserName ?? actorName, categoryName ?? "");
      case "contribution_processed":
        return m.contribution_processed(actorName, categoryName ?? "");
      case "access_request":
        return m.access_request(actorName);
    }
  })();

  const linkHref = notification.type === "access_request"
    ? "/admin"
    : notification.eventId
    ? `/events/${notification.eventId}`
    : notification.contributionId
    ? `/dashboard/${notification.contributionId}`
    : null;

  function handleClick() {
    if (!read) onRead();
    onClose();
  }

  const content = (
    <div
      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-surface ${!read ? "bg-gold-dim/30" : ""}`}
    >
      {actorPhotoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={actorPhotoURL} alt={actorName} className="mt-0.5 h-8 w-8 shrink-0 rounded-full ring-1 ring-rim" />
      ) : (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold text-ink-dim ring-1 ring-rim">
          {actorName[0]?.toUpperCase() ?? "?"}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${read ? "text-ink-dim" : "text-ink font-medium"}`}>
          {message}
        </p>
        <p className="mt-0.5 text-[11px] text-ink-subtle">{formatTime(createdAt)}</p>
      </div>
      {!read && (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gold" aria-hidden="true" />
      )}
    </div>
  );

  if (linkHref) {
    return (
      <Link href={linkHref} onClick={handleClick} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button onClick={handleClick} className="block w-full text-left">
      {content}
    </button>
  );
}
