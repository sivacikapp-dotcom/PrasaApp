"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeToNotifications,
  markAsRead,
  markAllAsRead,
  getNotificationSettings,
  updateNotificationSettings,
} from "@/lib/notificationService";
import type { AppNotification, NotificationSettings } from "@/types/notification";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/types/notification";

export function useNotifications() {
  const { appUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!appUser?.uid) return;
    return subscribeToNotifications(appUser.uid, setNotifications);
  }, [appUser?.uid]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = useCallback((id: string) => markAsRead(id), []);

  const handleMarkAllAsRead = useCallback(async () => {
    if (appUser?.uid) await markAllAsRead(appUser.uid);
  }, [appUser?.uid]);

  return { notifications, unreadCount, markAsRead: handleMarkAsRead, markAllAsRead: handleMarkAllAsRead };
}

export function useNotificationSettings() {
  const { appUser } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser?.uid) return;
    getNotificationSettings(appUser.uid).then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, [appUser?.uid]);

  const save = useCallback(
    async (next: NotificationSettings) => {
      if (!appUser?.uid) return;
      setSettings(next);
      await updateNotificationSettings(appUser.uid, next);
    },
    [appUser?.uid]
  );

  return { settings, loading, updateSettings: save };
}
