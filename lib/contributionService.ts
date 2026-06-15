import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Contribution, ContributionStatus, GeoLocation, VoiceNote } from "@/types/contribution";
import { notifyChroniclers } from "./notifyService";
import { createNotificationsForUsers, type Actor } from "./notificationService";

// ── Helpers ──────────────────────────────────────────────────────────────────

function tsToDate(v: unknown): Date {
  if (!v) return new Date();
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v as string);
}

function fromFirestore(id: string, data: Record<string, unknown>): Contribution {
  return {
    id,
    contributorId: (data.contributorId as string) ?? "",
    contributorName: (data.contributorName as string) ?? "",
    eventDate: tsToDate(data.eventDate),
    texts: Array.isArray(data.texts)
      ? (data.texts as string[])
      : data.text
        ? [data.text as string]
        : [],
    photoUrls: (data.photoUrls as string[]) ?? [],
    videoUrls: (data.videoUrls as string[]) ?? [],
    voices: Array.isArray(data.voices)
      ? (data.voices as VoiceNote[])
      : data.voiceUrl
        ? [{ url: data.voiceUrl as string, transcript: (data.voiceTranscript as string | null) ?? null }]
        : [],
    recordedAt: tsToDate(data.recordedAt),
    location: (data.location as GeoLocation | null) ?? null,
    locationName: (data.locationName as string | null) ?? null,
    verifiedEventDate: data.verifiedEventDate ? tsToDate(data.verifiedEventDate) : null,
    chroniclerText: (data.chroniclerText as string | null) ?? null,
    chroniclerVoiceUrl: (data.chroniclerVoiceUrl as string | null) ?? null,
    chroniclerPhotoUrls: (data.chroniclerPhotoUrls as string[]) ?? [],
    chroniclerVoiceTranscript: (data.chroniclerVoiceTranscript as string | null) ?? null,
    categories: (data.categories as string[]) ?? [],
    hashtags: (data.hashtags as string[]) ?? [],
    eventGroupIds: Array.isArray(data.eventGroupIds)
      ? (data.eventGroupIds as string[])
      : data.eventGroupId
      ? [data.eventGroupId as string]
      : [],
    status: (data.status as ContributionStatus) ?? "pending",
    deletedAt: data.deletedAt ? tsToDate(data.deletedAt) : null,
    deletedBy: (data.deletedBy as string | null) ?? null,
    visibleToIds: (data.visibleToIds as string[]) ?? [],
    taggedUserIds: (data.taggedUserIds as string[]) ?? [],
    createdAt: tsToDate(data.createdAt),
    updatedAt: tsToDate(data.updatedAt),
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export interface NewContributionInput {
  contributorId: string;
  contributorName: string;
  eventDate: Date;
  texts: string[];
  photoUrls: string[];
  videoUrls: string[];
  voices: VoiceNote[];
  location: GeoLocation | null;
  locationName?: string | null;
  categories?: string[];
  visibleToIds?: string[];
  taggedUserIds?: string[];
}

export async function createContribution(input: NewContributionInput): Promise<string> {
  const ref = await addDoc(collection(db, "contributions"), {
    ...input,
    eventDate: Timestamp.fromDate(input.eventDate),
    locationName: input.locationName ?? null,
    recordedAt: serverTimestamp(),
    verifiedEventDate: null,
    chroniclerText: null,
    chroniclerVoiceUrl: null,
    chroniclerPhotoUrls: [],
    chroniclerVoiceTranscript: null,
    categories: input.categories ?? [],
    hashtags: [],
    eventGroupIds: [],
    status: "pending",
    deletedAt: null,
    deletedBy: null,
    visibleToIds: input.visibleToIds ?? [input.contributorId],
    taggedUserIds: input.taggedUserIds ?? [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  notifyChroniclers(input.contributorName, input.eventDate).catch(() => {});
  return ref.id;
}

export async function getContribution(id: string): Promise<Contribution | null> {
  const snap = await getDoc(doc(db, "contributions", id));
  if (!snap.exists()) return null;
  return fromFirestore(snap.id, snap.data() as Record<string, unknown>);
}

export async function getAllContributions(): Promise<Contribution[]> {
  const snap = await getDocs(
    query(collection(db, "contributions"), orderBy("eventDate", "asc"))
  );
  return snap.docs
    .map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>))
    .filter((c) => c.status !== "deleted");
}

export async function getContributionsByUser(uid: string): Promise<Contribution[]> {
  const snap = await getDocs(
    query(collection(db, "contributions"), where("contributorId", "==", uid))
  );
  return snap.docs
    .map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>))
    .filter((c) => c.status !== "deleted")
    .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
}

export interface ContributorUpdateInput {
  eventDate?: Date;
  texts?: string[];
  photoUrls?: string[];
  videoUrls?: string[];
  voices?: VoiceNote[];
  location?: GeoLocation | null;
  taggedUserIds?: string[];
}

export async function updateContribution(
  id: string,
  data: ContributorUpdateInput
): Promise<void> {
  const payload: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.eventDate) payload.eventDate = Timestamp.fromDate(data.eventDate);
  await updateDoc(doc(db, "contributions", id), payload);
}

export interface ChroniclerUpdateInput {
  verifiedEventDate?: Date | null;
  chroniclerText?: string | null;
  chroniclerVoiceUrl?: string | null;
  chroniclerPhotoUrls?: string[];
  chroniclerVoiceTranscript?: string | null;
  voices?: VoiceNote[];
  categories?: string[];
  hashtags?: string[];
  status?: ContributionStatus;
  visibleToIds?: string[];
  taggedUserIds?: string[];
}

export async function updateContributionByChronicler(
  id: string,
  data: ChroniclerUpdateInput,
  actor?: Actor
): Promise<void> {
  // If actor provided and taggedUserIds is changing, read previous state for diff
  let prevTaggedUserIds: string[] = [];
  if (actor && data.taggedUserIds !== undefined) {
    const snap = await getDoc(doc(db, "contributions", id));
    prevTaggedUserIds = (snap.data()?.taggedUserIds as string[]) ?? [];
  }

  const payload: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.verifiedEventDate !== undefined) {
    payload.verifiedEventDate = data.verifiedEventDate
      ? Timestamp.fromDate(data.verifiedEventDate)
      : null;
  }
  await updateDoc(doc(db, "contributions", id), payload);

  // Notify newly tagged users
  if (actor && data.taggedUserIds !== undefined) {
    const newlyTagged = data.taggedUserIds.filter((uid) => !prevTaggedUserIds.includes(uid));
    if (newlyTagged.length > 0) {
      createNotificationsForUsers(
        newlyTagged.map((userId) => ({
          userId,
          type: "user_tagged" as const,
          actorId: actor.uid,
          actorName: actor.displayName,
          actorPhotoURL: actor.photoURL,
          contributionId: id,
        }))
      );
    }
  }
}

export async function softDeleteContribution(
  id: string,
  deletedBy: string,
  actor?: Actor
): Promise<void> {
  // Read contribution to notify owner
  let contributorId = "";
  if (actor) {
    const snap = await getDoc(doc(db, "contributions", id));
    contributorId = (snap.data()?.contributorId as string) ?? "";
  }

  await updateDoc(doc(db, "contributions", id), {
    status: "deleted",
    deletedAt: serverTimestamp(),
    deletedBy,
    updatedAt: serverTimestamp(),
  });

  if (actor && contributorId && contributorId !== deletedBy) {
    createNotificationsForUsers([{
      userId: contributorId,
      type: "contribution_deleted",
      actorId: actor.uid,
      actorName: actor.displayName,
      actorPhotoURL: actor.photoURL,
      contributionId: id,
    }]);
  }
}

export async function restoreContribution(id: string): Promise<void> {
  await updateDoc(doc(db, "contributions", id), {
    status: "pending",
    deletedAt: null,
    deletedBy: null,
    updatedAt: serverTimestamp(),
  });
}

export async function permanentlyDeleteContribution(id: string): Promise<void> {
  await deleteDoc(doc(db, "contributions", id));
}

export async function batchSoftDelete(ids: string[], deletedBy: string, actor?: Actor): Promise<void> {
  await Promise.all(ids.map((id) => softDeleteContribution(id, deletedBy, actor)));
}

export async function batchRestore(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => restoreContribution(id)));
}

export async function batchPermanentlyDelete(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => permanentlyDeleteContribution(id)));
}

// kept for backwards-compat (contributor's own hard-delete on dashboard detail)
export async function deleteContribution(id: string): Promise<void> {
  await deleteDoc(doc(db, "contributions", id));
}

// ── Real-time listeners ───────────────────────────────────────────────────────

export function subscribeToAllContributions(
  cb: (contributions: Contribution[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "contributions"), orderBy("eventDate", "asc")),
    (snap) => cb(
      snap.docs
        .map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>))
        .filter((c) => c.status !== "deleted")
    )
  );
}

export function subscribeToMyContributions(
  uid: string,
  cb: (contributions: Contribution[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "contributions"), where("contributorId", "==", uid)),
    (snap) => {
      const results = snap.docs
        .map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>))
        .filter((c) => c.status !== "deleted")
        .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
      cb(results);
    }
  );
}

export function subscribeToAccessibleContributions(
  uid: string,
  cb: (contributions: Contribution[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "contributions"), where("visibleToIds", "array-contains", uid)),
    (snap) => {
      const results = snap.docs
        .map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>))
        .filter((c) => c.status !== "deleted")
        .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
      cb(results);
    }
  );
}

export function subscribeToTrashedContributions(
  cb: (contributions: Contribution[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "contributions"), where("status", "==", "deleted")),
    (snap) => {
      const results = snap.docs
        .map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => {
          const ta = (b.deletedAt ?? b.updatedAt).getTime();
          const tb = (a.deletedAt ?? a.updatedAt).getTime();
          return ta - tb;
        });
      cb(results);
    }
  );
}

export function subscribeToMyDeletedContributions(
  uid: string,
  cb: (contributions: Contribution[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "contributions"), where("contributorId", "==", uid)),
    (snap) => {
      const results = snap.docs
        .map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>))
        .filter((c) => c.status === "deleted")
        .sort((a, b) => {
          const ta = (b.deletedAt ?? b.updatedAt).getTime();
          const tb = (a.deletedAt ?? a.updatedAt).getTime();
          return ta - tb;
        });
      cb(results);
    }
  );
}
