import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "./firebase";
import { createNotificationsForUsers, type Actor } from "./notificationService";
import type { Group, Tag } from "@/types/contribution";

// ── Categories ────────────────────────────────────────────────────────────────

function catFromDoc(id: string, d: Record<string, unknown>): Group {
  const ts = (v: unknown) => (v instanceof Timestamp ? v.toDate() : new Date());
  return {
    id,
    name: (d.name as string) ?? "",
    color: (d.color as string) ?? "#6366f1",
    icon: (d.icon as string | undefined) ?? undefined,
    allowedUserIds: (d.allowedUserIds as string[]) ?? [],
    createdBy: (d.createdBy as string) ?? "",
    createdAt: ts(d.createdAt),
  };
}

function tagFromDoc(id: string, d: Record<string, unknown>): Tag {
  const ts = (v: unknown) => (v instanceof Timestamp ? v.toDate() : new Date());
  return {
    id,
    name: (d.name as string) ?? "",
    categoryIds: (d.categoryIds as string[]) ?? [],
    createdBy: (d.createdBy as string) ?? "",
    createdAt: ts(d.createdAt),
  };
}

export async function getCategories(): Promise<Group[]> {
  const snap = await getDocs(query(collection(db, "categories"), orderBy("name")));
  return snap.docs.map((d) => catFromDoc(d.id, d.data() as Record<string, unknown>));
}

export async function createCategory(
  name: string,
  color: string,
  icon: string,
  createdBy: string
): Promise<Group> {
  const ref = await addDoc(collection(db, "categories"), {
    name,
    color,
    ...(icon ? { icon } : {}),
    createdBy,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, name, color, icon: icon || undefined, allowedUserIds: [], createdBy, createdAt: new Date() };
}

export async function updateCategory(id: string, name: string, color: string, icon: string): Promise<void> {
  await updateDoc(doc(db, "categories", id), { name, color, icon: icon || null });
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, "categories", id));
}

export async function updateCategoryAccess(
  id: string,
  allowedUserIds: string[],
  actor?: Actor
): Promise<void> {
  let prevAllowedUserIds: string[] = [];
  let categoryName = "";

  if (actor) {
    const catSnap = await getDoc(doc(db, "categories", id));
    if (catSnap.exists()) {
      prevAllowedUserIds = (catSnap.data().allowedUserIds as string[]) ?? [];
      categoryName = (catSnap.data().name as string) ?? "";
    }
  }

  await updateDoc(doc(db, "categories", id), { allowedUserIds });

  if (actor) {
    const added = allowedUserIds.filter((uid) => !prevAllowedUserIds.includes(uid));
    const removed = prevAllowedUserIds.filter((uid) => !allowedUserIds.includes(uid));

    if (added.length > 0 || removed.length > 0) {
      // Fetch display names for added/removed users
      const usersToFetch = [...new Set([...added, ...removed])];
      const userNames = new Map<string, string>();
      await Promise.all(
        usersToFetch.map(async (uid) => {
          const snap = await getDoc(doc(db, "users", uid));
          userNames.set(uid, (snap.data()?.displayName as string) ?? uid);
        })
      );

      const notifications = [];

      // Someone added: notify all previous members (not the added person itself, not the actor)
      for (const addedUid of added) {
        const extraUserName = userNames.get(addedUid) ?? addedUid;
        const recipients = prevAllowedUserIds.filter((uid) => uid !== addedUid && uid !== actor.uid);
        for (const uid of recipients) {
          notifications.push({
            userId: uid,
            type: "user_added_to_group" as const,
            actorId: actor.uid,
            actorName: actor.displayName,
            actorPhotoURL: actor.photoURL,
            categoryId: id,
            categoryName,
            extraUserName,
          });
        }
      }

      // Someone removed: notify remaining members (not the removed person, not the actor)
      for (const removedUid of removed) {
        const extraUserName = userNames.get(removedUid) ?? removedUid;
        const recipients = allowedUserIds.filter((uid) => uid !== removedUid && uid !== actor.uid);
        for (const uid of recipients) {
          notifications.push({
            userId: uid,
            type: "user_removed_from_group" as const,
            actorId: actor.uid,
            actorName: actor.displayName,
            actorPhotoURL: actor.photoURL,
            categoryId: id,
            categoryName,
            extraUserName,
          });
        }
      }

      if (notifications.length > 0) {
        createNotificationsForUsers(notifications);
      }
    }
  }
}

export function subscribeToCategories(cb: (cats: Group[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, "categories"), orderBy("name")), (snap) =>
    cb(snap.docs.map((d) => catFromDoc(d.id, d.data() as Record<string, unknown>)))
  );
}

// ── Tags (hashtags) ───────────────────────────────────────────────────────────

export async function getTags(): Promise<Tag[]> {
  const snap = await getDocs(query(collection(db, "tags"), orderBy("name")));
  return snap.docs.map((d) => tagFromDoc(d.id, d.data() as Record<string, unknown>));
}

export async function createTag(name: string, createdBy: string): Promise<Tag> {
  const normalised = name.startsWith("#") ? name : `#${name}`;
  const ref = await addDoc(collection(db, "tags"), {
    name: normalised,
    createdBy,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, name: normalised, categoryIds: [], createdBy, createdAt: new Date() };
}

export async function updateTagCategories(id: string, categoryIds: string[]): Promise<void> {
  await updateDoc(doc(db, "tags", id), { categoryIds });
}

export async function deleteTag(id: string): Promise<void> {
  await deleteDoc(doc(db, "tags", id));
}

export function subscribeToTags(cb: (tags: Tag[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, "tags"), orderBy("name")), (snap) =>
    cb(snap.docs.map((d) => tagFromDoc(d.id, d.data() as Record<string, unknown>)))
  );
}
