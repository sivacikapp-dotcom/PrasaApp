export type UserRole = "admin" | "chronicler" | "contributor";
export type UserStatus = "pending" | "active" | "blocked";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  roles: UserRole[];
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}
