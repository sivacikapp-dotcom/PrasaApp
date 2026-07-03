import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./firebase";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const ALLOWED_AUDIO_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg"]);

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;  // 20 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;  // 50 MB

function assertType(file: File | Blob, allowed: Set<string>, label: string) {
  const baseType = file.type.split(";")[0].trim();
  if (!allowed.has(baseType)) throw new Error(`Nepodporovaný formát súboru (${label})`);
}

function assertSize(file: File | Blob, max: number, label: string) {
  if (file.size > max) throw new Error(`Súbor je príliš veľký (${label})`);
}

export async function uploadPhoto(
  file: File,
  contributionId: string,
  uid: string,
  index = 0
): Promise<string> {
  assertType(file, ALLOWED_IMAGE_TYPES, "foto");
  assertSize(file, MAX_PHOTO_BYTES, "foto max 20 MB");
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `contributions/${uid}/${contributionId}/photos/${Date.now()}_${index}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadChroniclerPhoto(
  file: File,
  contributionId: string,
  index = 0
): Promise<string> {
  assertType(file, ALLOWED_IMAGE_TYPES, "foto");
  assertSize(file, MAX_PHOTO_BYTES, "foto max 20 MB");
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `chronicler/${contributionId}/photos/${Date.now()}_${index}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadVideo(
  file: File,
  contributionId: string,
  uid: string
): Promise<string> {
  assertType(file, ALLOWED_VIDEO_TYPES, "video");
  assertSize(file, MAX_VIDEO_BYTES, "video max 200 MB");
  const ext = file.name.split(".").pop() ?? "mp4";
  const path = `contributions/${uid}/${contributionId}/videos/${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadVideoBlob(
  blob: Blob,
  contributionId: string,
  uid: string
): Promise<string> {
  assertType(blob, ALLOWED_VIDEO_TYPES, "video");
  assertSize(blob, MAX_VIDEO_BYTES, "video max 200 MB");
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const path = `contributions/${uid}/${contributionId}/video_${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

export async function uploadVoice(
  blob: Blob,
  contributionId: string,
  uid: string
): Promise<string> {
  assertType(blob, ALLOWED_AUDIO_TYPES, "audio");
  assertSize(blob, MAX_AUDIO_BYTES, "audio max 50 MB");
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const path = `contributions/${uid}/${contributionId}/voice_${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

export async function uploadChroniclerVideo(
  file: File | Blob,
  contributionId: string,
  index = 0
): Promise<string> {
  assertType(file, ALLOWED_VIDEO_TYPES, "video");
  assertSize(file, MAX_VIDEO_BYTES, "video max 200 MB");
  const ext = file instanceof File
    ? (file.name.split('.').pop() ?? 'mp4')
    : file.type.includes('mp4') ? 'mp4' : 'webm';
  const path = `chronicler/${contributionId}/videos/${Date.now()}_${index}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadChroniclerVoice(
  blob: Blob,
  contributionId: string
): Promise<string> {
  assertType(blob, ALLOWED_AUDIO_TYPES, "audio");
  assertSize(blob, MAX_AUDIO_BYTES, "audio max 50 MB");
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const path = `chronicler/${contributionId}/voice.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

export async function deleteFile(url: string): Promise<void> {
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch {
    // file may already be deleted
  }
}
