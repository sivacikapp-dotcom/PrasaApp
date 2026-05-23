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
    visibleToIds: (data.visibleToIds as string[]) ?? [],
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
    categories: [],
    hashtags: [],
    eventGroupIds: [],
    status: "pending",
    visibleToIds: [input.contributorId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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
  return snap.docs.map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>));
}

export async function getContributionsByUser(uid: string): Promise<Contribution[]> {
  const snap = await getDocs(
    query(collection(db, "contributions"), where("contributorId", "==", uid))
  );
  return snap.docs
    .map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
}

export interface ContributorUpdateInput {
  eventDate?: Date;
  texts?: string[];
  photoUrls?: string[];
  videoUrls?: string[];
  voices?: VoiceNote[];
  location?: GeoLocation | null;
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
}

export async function updateContributionByChronicler(
  id: string,
  data: ChroniclerUpdateInput
): Promise<void> {
  const payload: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.verifiedEventDate !== undefined) {
    payload.verifiedEventDate = data.verifiedEventDate
      ? Timestamp.fromDate(data.verifiedEventDate)
      : null;
  }
  await updateDoc(doc(db, "contributions", id), payload);
}

export async function deleteContribution(id: string): Promise<void> {
  await deleteDoc(doc(db, "contributions", id));
}

// ── Real-time listeners ───────────────────────────────────────────────────────

export function subscribeToAllContributions(
  cb: (contributions: Contribution[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "contributions"), orderBy("eventDate", "asc")),
    (snap) => cb(snap.docs.map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>)))
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
        .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
      cb(results);
    }
  );
}
