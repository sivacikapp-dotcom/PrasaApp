import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  limit,
  serverTimestamp,
  Timestamp,
  getDoc,
  getDocs,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { getAuthHeaders } from "@/lib/authHeaders";
import type { AppNotification, NotificationType, NotificationSettings, NotificationPref } from "@/types/notification";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/types/notification";

export interface Actor {
  uid: string;
  displayName: string;
  photoURL?: string | null;
}

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  actorId: string;
  actorName: string;
  actorPhotoURL?: string | null;
  contributionId?: string;
  eventId?: string;
  eventTitle?: string;
  categoryId?: string;
  categoryName?: string;
  extraUserName?: string;
}

function fromFirestore(id: string, data: Record<string, unknown>): AppNotification {
  const ts = (v: unknown): Date => {
    if (!v) return new Date();
    if (v instanceof Timestamp) return v.toDate();
    return new Date(v as string);
  };
  return {
    id,
    userId: (data.userId as string) ?? "",
    type: data.type as NotificationType,
    read: (data.read as boolean) ?? false,
    createdAt: ts(data.createdAt),
    actorId: (data.actorId as string) ?? "",
    actorName: (data.actorName as string) ?? "",
    actorPhotoURL: (data.actorPhotoURL as string | null) ?? null,
    contributionId: data.contributionId as string | undefined,
    eventId: data.eventId as string | undefined,
    eventTitle: data.eventTitle as string | undefined,
    categoryId: data.categoryId as string | undefined,
    categoryName: data.categoryName as string | undefined,
    extraUserName: data.extraUserName as string | undefined,
  };
}

async function createOneNotification(input: NotificationInput): Promise<void> {
  try {
    const userSnap = await getDoc(doc(db, "users", input.userId));
    if (!userSnap.exists()) return;

    const userData = userSnap.data() as Record<string, unknown>;
    const saved = userData.notificationSettings as Partial<NotificationSettings> | undefined;
    const settings: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS, ...saved };
    const pref: NotificationPref = settings[input.type];

    if (pref === "off") return;

    const { userId, ...rest } = input;
    await addDoc(collection(db, "notifications"), {
      userId,
      ...rest,
      read: false,
      createdAt: serverTimestamp(),
    });

    if (pref === "push") {
      const tokens = (userData.fcmTokens as string[]) ?? [];
      if (tokens.length > 0) {
        getAuthHeaders().then((authHeaders) =>
          fetch("/api/push-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
              tokens,
              type: input.type,
              actorName: input.actorName,
              eventTitle: input.eventTitle,
              categoryName: input.categoryName,
              extraUserName: input.extraUserName,
            }),
          })
        ).catch(() => {});
      }
    }
  } catch {
    // Notifications are fire-and-forget
  }
}

export function createNotificationsForUsers(inputs: NotificationInput[]): void {
  if (inputs.length === 0) return;
  Promise.all(inputs.map(createOneNotification)).catch(() => {});
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export function subscribeToNotifications(
  userId: string,
  cb: (notifications: AppNotification[]) => void
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      limit(100)
    ),
    (snap) => {
      const items = snap.docs
        .map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 50);
      cb(items);
    }
  );
}

// ── Read / Update ─────────────────────────────────────────────────────────────

export async function markAsRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, "notifications", notificationId), { read: true });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, "notifications"), where("userId", "==", userId))
  );
  const unread = snap.docs.filter((d) => d.data().read === false);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}

export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) return { ...DEFAULT_NOTIFICATION_SETTINGS };
  const saved = snap.data().notificationSettings as Partial<NotificationSettings> | undefined;
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...saved };
}

export async function updateNotificationSettings(
  userId: string,
  settings: NotificationSettings
): Promise<void> {
  await updateDoc(doc(db, "users", userId), { notificationSettings: settings });
}

// ── FCM Token Management ──────────────────────────────────────────────────────

export async function saveFcmToken(userId: string, token: string): Promise<void> {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const existing = (snap.data().fcmTokens as string[]) ?? [];
  if (!existing.includes(token)) {
    await updateDoc(ref, { fcmTokens: [...existing, token] });
  }
}

export async function removeFcmToken(userId: string, token: string): Promise<void> {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const existing = (snap.data().fcmTokens as string[]) ?? [];
  await updateDoc(ref, { fcmTokens: existing.filter((t) => t !== token) });
}
