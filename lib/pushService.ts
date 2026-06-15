import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging";
import { app } from "./firebase";
import { saveFcmToken, removeFcmToken } from "./notificationService";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

export type PushPermissionState = "granted" | "denied" | "default" | "unsupported";

export function getPushPermissionState(): PushPermissionState {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission as PushPermissionState;
}

export async function requestPushPermission(userId: string): Promise<PushPermissionState> {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";

  const supported = await isSupported().catch(() => false);
  if (!supported) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission as PushPermissionState;

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) return "denied";

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) await saveFcmToken(userId, token);
    return "granted";
  } catch {
    return "denied";
  }
}

export async function revokePushToken(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const supported = await isSupported().catch(() => false);
    if (!supported) return;

    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) return;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    }).catch(() => null);

    if (token) {
      await deleteToken(messaging);
      await removeFcmToken(userId, token);
    }
  } catch {
    // Non-blocking
  }
}
