const DB_NAME = "prasa-offline";
const DB_VERSION = 1;
const STORE = "pending_contributions";

export interface PendingContribution {
  id: string;
  contributorId: string;
  contributorName: string;
  eventDate: string; // ISO string
  texts: string[];
  location: { latitude: number; longitude: number; accuracy: number } | null;
  locationName: string | null;
  photoBlobs: Blob[];
  videoBlobs: Blob[];
  voiceBlobs: Array<{ blob: Blob; mimeType: string }>;
  createdAt: string; // ISO string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePending(item: PendingContribution): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  window.dispatchEvent(new CustomEvent("prasa:pending-changed"));
}

export async function getAllPending(): Promise<PendingContribution[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as PendingContribution[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePending(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  window.dispatchEvent(new CustomEvent("prasa:pending-changed"));
}

export async function countPending(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
