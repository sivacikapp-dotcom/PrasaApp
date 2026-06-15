import type { NotificationSettings } from "./notification";
import type { UserPreferences } from "./userPreferences";

export type UserRole = "admin" | "chronicler" | "contributor";
export type UserStatus = "pending" | "active" | "blocked";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  roles: UserRole[];
  status: UserStatus;
  notificationSettings?: NotificationSettings;
  userPreferences?: UserPreferences;
  fcmTokens?: string[];
  createdAt: Date;
  updatedAt: Date;
}
