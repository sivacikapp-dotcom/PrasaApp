import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import type { AppUser, UserRole, UserStatus } from "@/types/user";
import { notifyAdmins } from "./notifyService";

function toAppUser(data: Record<string, unknown>, uid: string): AppUser {
  const ts = (v: unknown) =>
    v && typeof (v as { toDate?: () => Date }).toDate === "function"
      ? (v as { toDate: () => Date }).toDate()
      : new Date();
  return {
    uid,
    email: (data.email as string) ?? "",
    displayName: (data.displayName as string) ?? "",
    photoURL: (data.photoURL as string | null) ?? null,
    roles: (data.roles as UserRole[]) ?? [],
    status: (data.status as UserStatus) ?? "pending",
    createdAt: ts(data.createdAt),
    updatedAt: ts(data.updatedAt),
  };
}

/**
 * On first sign-in creates a pending user with no roles.
 * Subsequent sign-ins return the existing document unchanged.
 */
export async function getOrCreateUser(firebaseUser: User): Promise<AppUser> {
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const newUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? "",
      displayName: firebaseUser.displayName ?? "",
      photoURL: firebaseUser.photoURL,
      roles: [] as UserRole[],
      status: "pending" as UserStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, newUser);
    notifyAdmins(newUser.displayName || newUser.email, newUser.email).catch(() => {});
    return { ...newUser, createdAt: new Date(), updatedAt: new Date() };
  }

  return toAppUser(snap.data() as Record<string, unknown>, firebaseUser.uid);
}

export async function getUserById(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return toAppUser(snap.data() as Record<string, unknown>, uid);
}

export async function getAllUsers(): Promise<AppUser[]> {
  const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => toAppUser(d.data() as Record<string, unknown>, d.id));
}

export async function updateUserRoles(uid: string, roles: UserRole[]): Promise<void> {
  await updateDoc(doc(db, "users", uid), { roles, updatedAt: serverTimestamp() });
}

export async function updateUserStatus(uid: string, status: UserStatus): Promise<void> {
  await updateDoc(doc(db, "users", uid), { status, updatedAt: serverTimestamp() });
}

export async function updateUserRolesAndStatus(
  uid: string,
  roles: UserRole[],
  status: UserStatus
): Promise<void> {
  await updateDoc(doc(db, "users", uid), { roles, status, updatedAt: serverTimestamp() });
}
