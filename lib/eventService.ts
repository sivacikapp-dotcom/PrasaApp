import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove,
  query,
  orderBy,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { getCategories } from "./categoryService";
import type { ChronicleEvent } from "@/types/contribution";

function tsToDate(v: unknown): Date {
  if (!v) return new Date();
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v as string);
}

function fromFirestore(id: string, data: Record<string, unknown>): ChronicleEvent {
  return {
    id,
    title: (data.title as string) ?? "",
    locationName: (data.locationName as string | null) ?? null,
    dateFrom: data.dateFrom ? tsToDate(data.dateFrom) : null,
    dateTo: data.dateTo ? tsToDate(data.dateTo) : null,
    description: (data.description as string | null) ?? null,
    contributionIds: (data.contributionIds as string[]) ?? [],
    entityOrder: (data.entityOrder as string[]) ?? [],
    categoryId: (data.categoryId as string | null) ?? null,
    hiddenItems: (data.hiddenItems as string[]) ?? [],
    categories: (data.categories as string[]) ?? [],
    hashtags: (data.hashtags as string[]) ?? [],
    editorIds: (data.editorIds as string[]) ?? [],
    createdBy: (data.createdBy as string) ?? "",
    createdAt: tsToDate(data.createdAt),
    updatedAt: tsToDate(data.updatedAt),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function markContributionsProcessed(ids: string[], allowedUserIds: string[] = []): Promise<void> {
  await Promise.all(
    ids.map(async (id) => {
      if (allowedUserIds.length > 0) {
        const cRef = doc(db, "contributions", id);
        const cSnap = await getDoc(cRef);
        if (!cSnap.exists()) return;
        const existing: string[] = (cSnap.data().visibleToIds as string[]) ?? [];
        const merged = [...new Set([...existing, ...allowedUserIds])];
        await updateDoc(cRef, { status: "processed", visibleToIds: merged, updatedAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, "contributions", id), { status: "processed", updatedAt: serverTimestamp() });
      }
    })
  );
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createEvent(input: {
  title: string;
  contributionIds: string[];
  categoryId: string | null;
  createdBy: string;
}): Promise<string> {
  let allowedUserIds: string[] = [];
  if (input.categoryId) {
    const allCats = await getCategories();
    const cat = allCats.find((c) => c.id === input.categoryId);
    allowedUserIds = cat?.allowedUserIds ?? [];
  }

  const ref = await addDoc(collection(db, "events"), {
    title: input.title,
    locationName: null,
    dateFrom: null,
    dateTo: null,
    description: null,
    contributionIds: input.contributionIds,
    entityOrder: [],
    categoryId: input.categoryId ?? null,
    hiddenItems: [],
    categories: [],
    hashtags: [],
    editorIds: [],
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await markContributionsProcessed(input.contributionIds, allowedUserIds);
  return ref.id;
}

export async function getEvent(id: string): Promise<ChronicleEvent | null> {
  const snap = await getDoc(doc(db, "events", id));
  if (!snap.exists()) return null;
  return fromFirestore(snap.id, snap.data() as Record<string, unknown>);
}

export interface EventUpdateInput {
  title?: string;
  locationName?: string | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  description?: string | null;
  categoryId?: string | null;
  categories?: string[];
  hashtags?: string[];
}

export async function updateEvent(id: string, data: EventUpdateInput): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (data.title !== undefined) payload.title = data.title;
  if (data.locationName !== undefined) payload.locationName = data.locationName;
  if (data.description !== undefined) payload.description = data.description;
  if (data.categoryId !== undefined) payload.categoryId = data.categoryId;
  if (data.categories !== undefined) payload.categories = data.categories;
  if (data.hashtags !== undefined) payload.hashtags = data.hashtags;
  if ("dateFrom" in data) {
    payload.dateFrom = data.dateFrom ? Timestamp.fromDate(data.dateFrom) : null;
  }
  if ("dateTo" in data) {
    payload.dateTo = data.dateTo ? Timestamp.fromDate(data.dateTo) : null;
  }
  await updateDoc(doc(db, "events", id), payload);
}

export async function setEventHiddenItems(eventId: string, hiddenItems: string[]): Promise<void> {
  await updateDoc(doc(db, "events", eventId), { hiddenItems, updatedAt: serverTimestamp() });
}

export async function setEventEntityOrder(eventId: string, order: string[]): Promise<void> {
  await updateDoc(doc(db, "events", eventId), { entityOrder: order, updatedAt: serverTimestamp() });
}

export async function getEventsForUser(
  allowedCategoryIds: string[],
  uid?: string
): Promise<ChronicleEvent[]> {
  const all = await getEvents();
  return all.filter((ev) => {
    const categoryOk = ev.categoryId != null && allowedCategoryIds.includes(ev.categoryId);
    const isEditor = uid != null && ev.editorIds.includes(uid);
    return categoryOk || isEditor;
  });
}

export async function addEventEditor(eventId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, "events", eventId), {
    editorIds: arrayUnion(uid),
    updatedAt: serverTimestamp(),
  });
}

export async function removeEventEditor(eventId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, "events", eventId), {
    editorIds: arrayRemove(uid),
    updatedAt: serverTimestamp(),
  });
}

export async function addContributionsToEvent(
  eventId: string,
  newIds: string[]
): Promise<void> {
  const ref = doc(db, "events", eventId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const eventData = snap.data();
  const current = (eventData.contributionIds as string[]) ?? [];
  const categoryId = (eventData.categoryId as string | null) ?? null;
  const toAdd = newIds.filter((id) => !current.includes(id));
  if (toAdd.length === 0) return;

  let allowedUserIds: string[] = [];
  if (categoryId) {
    const allCats = await getCategories();
    const cat = allCats.find((c) => c.id === categoryId);
    allowedUserIds = cat?.allowedUserIds ?? [];
  }

  await Promise.all([
    updateDoc(ref, {
      contributionIds: [...current, ...toAdd],
      updatedAt: serverTimestamp(),
    }),
    markContributionsProcessed(toAdd, allowedUserIds),
  ]);
}

export async function removeContributionFromEvent(
  eventId: string,
  contributionId: string
): Promise<void> {
  const ref = doc(db, "events", eventId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const current = (snap.data().contributionIds as string[]) ?? [];
  await updateDoc(ref, {
    contributionIds: current.filter((id) => id !== contributionId),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, "events", id));
}

// ── Real-time ────────────────────────────────────────────────────────────────

export function subscribeToEvents(
  cb: (events: ChronicleEvent[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "events"), orderBy("createdAt", "desc")),
    (snap) =>
      cb(snap.docs.map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>)))
  );
}

export async function getEvents(): Promise<ChronicleEvent[]> {
  const snap = await getDocs(
    query(collection(db, "events"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>));
}
