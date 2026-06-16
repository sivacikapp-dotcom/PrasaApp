export type NotificationType =
  | "user_tagged"
  | "contribution_added_to_event"
  | "contribution_removed_from_event"
  | "contribution_deleted"
  | "event_created"
  | "user_added_to_group"
  | "user_removed_from_group"
  | "contribution_processed"
  | "access_request";

export type NotificationPref = "push" | "in_app" | "off";

export interface NotificationSettings {
  user_tagged: NotificationPref;
  contribution_added_to_event: NotificationPref;
  contribution_removed_from_event: NotificationPref;
  contribution_deleted: NotificationPref;
  event_created: NotificationPref;
  user_added_to_group: NotificationPref;
  user_removed_from_group: NotificationPref;
  contribution_processed: NotificationPref;
  access_request: NotificationPref;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  user_tagged: "push",
  contribution_added_to_event: "push",
  contribution_removed_from_event: "push",
  contribution_deleted: "push",
  event_created: "in_app",
  user_added_to_group: "in_app",
  user_removed_from_group: "in_app",
  contribution_processed: "in_app",
  access_request: "push",
};

export const NOTIFICATION_TYPES: NotificationType[] = [
  "user_tagged",
  "contribution_added_to_event",
  "contribution_removed_from_event",
  "contribution_deleted",
  "event_created",
  "user_added_to_group",
  "user_removed_from_group",
  "contribution_processed",
  "access_request",
];

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  read: boolean;
  createdAt: Date;
  actorId: string;
  actorName: string;
  actorPhotoURL?: string | null;
  contributionId?: string;
  eventId?: string;
  eventTitle?: string;
  categoryId?: string;
  categoryName?: string;
  extraUserName?: string;
}
