import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { UserPreferences } from "@/types/userPreferences";
import { DEFAULT_USER_PREFERENCES } from "@/types/userPreferences";

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) return { ...DEFAULT_USER_PREFERENCES };
  const saved = snap.data().userPreferences as Partial<UserPreferences> | undefined;
  if (!saved) return { ...DEFAULT_USER_PREFERENCES };
  return {
    contributions: { ...DEFAULT_USER_PREFERENCES.contributions, ...saved.contributions },
    events: { ...DEFAULT_USER_PREFERENCES.events, ...saved.events },
    defaultGroupIds: saved.defaultGroupIds ?? DEFAULT_USER_PREFERENCES.defaultGroupIds,
  };
}

export async function updateUserPreferences(
  userId: string,
  prefs: UserPreferences
): Promise<void> {
  await updateDoc(doc(db, "users", userId), { userPreferences: prefs });
}
