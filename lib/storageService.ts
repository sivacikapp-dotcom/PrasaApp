import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./firebase";

export async function uploadPhoto(
  file: File,
  contributionId: string,
  uid: string
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `contributions/${uid}/${contributionId}/photos/${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadChroniclerPhoto(
  file: File,
  contributionId: string
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `chronicler/${contributionId}/photos/${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadVideo(
  file: File,
  contributionId: string,
  uid: string
): Promise<string> {
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
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const path = `contributions/${uid}/${contributionId}/voice_${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

export async function uploadChroniclerVoice(
  blob: Blob,
  contributionId: string
): Promise<string> {
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
