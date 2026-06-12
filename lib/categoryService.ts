import {
  collection,
  doc,
  addDoc,
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
import type { Group, Tag } from "@/types/contribution";

// ── Categories ────────────────────────────────────────────────────────────────

function catFromDoc(id: string, d: Record<string, unknown>): Group {
  const ts = (v: unknown) => (v instanceof Timestamp ? v.toDate() : new Date());
  return {
    id,
    name: (d.name as string) ?? "",
    color: (d.color as string) ?? "#6366f1",
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
  createdBy: string
): Promise<Group> {
  const ref = await addDoc(collection(db, "categories"), {
    name,
    color,
    createdBy,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, name, color, allowedUserIds: [], createdBy, createdAt: new Date() };
}

export async function updateCategory(id: string, name: string, color: string): Promise<void> {
  await updateDoc(doc(db, "categories", id), { name, color });
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, "categories", id));
}

export async function updateCategoryAccess(id: string, allowedUserIds: string[]): Promise<void> {
  await updateDoc(doc(db, "categories", id), { allowedUserIds });
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
