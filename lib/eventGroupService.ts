import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
  query,
  orderBy,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { EventGroup } from "@/types/contribution";

function tsToDate(v: unknown): Date {
  if (!v) return new Date();
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v as string);
}

function fromFirestore(id: string, data: Record<string, unknown>): EventGroup {
  return {
    id,
    title: (data.title as string) ?? "",
    contributionIds: (data.contributionIds as string[]) ?? [],
    createdBy: (data.createdBy as string) ?? "",
    createdAt: tsToDate(data.createdAt),
    updatedAt: tsToDate(data.updatedAt),
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createEventGroup(
  title: string,
  contributionIds: string[],
  createdBy: string
): Promise<string> {
  const batch = writeBatch(db);
  const groupRef = doc(collection(db, "eventGroups"));
  batch.set(groupRef, {
    title,
    contributionIds,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  for (const cid of contributionIds) {
    batch.update(doc(db, "contributions", cid), {
      eventGroupIds: arrayUnion(groupRef.id),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return groupRef.id;
}

export async function renameEventGroup(groupId: string, title: string): Promise<void> {
  await updateDoc(doc(db, "eventGroups", groupId), {
    title,
    updatedAt: serverTimestamp(),
  });
}

export async function addContributionsToGroup(
  groupId: string,
  newIds: string[]
): Promise<void> {
  const groupRef = doc(db, "eventGroups", groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) return;
  const current = (snap.data().contributionIds as string[]) ?? [];
  const toAdd = newIds.filter((id) => !current.includes(id));
  if (toAdd.length === 0) return;
  const batch = writeBatch(db);
  batch.update(groupRef, {
    contributionIds: [...current, ...toAdd],
    updatedAt: serverTimestamp(),
  });
  for (const cid of toAdd) {
    batch.update(doc(db, "contributions", cid), {
      eventGroupIds: arrayUnion(groupId),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function removeContributionFromGroup(
  groupId: string,
  contributionId: string
): Promise<void> {
  const groupRef = doc(db, "eventGroups", groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) return;
  const current = (snap.data().contributionIds as string[]) ?? [];
  const batch = writeBatch(db);
  batch.update(groupRef, {
    contributionIds: current.filter((id) => id !== contributionId),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, "contributions", contributionId), {
    eventGroupIds: arrayRemove(groupId),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function deleteEventGroup(groupId: string): Promise<void> {
  const groupRef = doc(db, "eventGroups", groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) return;
  const contributionIds = (snap.data().contributionIds as string[]) ?? [];
  const batch = writeBatch(db);
  for (const cid of contributionIds) {
    batch.update(doc(db, "contributions", cid), {
      eventGroupIds: arrayRemove(groupId),
      updatedAt: serverTimestamp(),
    });
  }
  batch.delete(groupRef);
  await batch.commit();
}

// ── Real-time ────────────────────────────────────────────────────────────────

export function subscribeToEventGroups(
  cb: (groups: EventGroup[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "eventGroups"), orderBy("createdAt", "desc")),
    (snap) =>
      cb(snap.docs.map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>)))
  );
}

export async function getEventGroups(): Promise<EventGroup[]> {
  const snap = await getDocs(
    query(collection(db, "eventGroups"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>));
}
