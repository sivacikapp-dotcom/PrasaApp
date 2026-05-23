"use client";

// Lightweight helpers to sync Firebase auth state with the "session" cookie
// so that the Next.js middleware can perform a basic redirect guard.
// The cookie holds the Firebase ID token — it is NOT a secure session cookie
// and is verified only client-side. For production you would replace this
// with server-side token verification using the Firebase Admin SDK.

export function setSessionCookie(token: string) {
  const maxAge = 60 * 60; // 1 hour — matches Firebase ID token lifetime
  document.cookie = `session=${token}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

export function clearSessionCookie() {
  document.cookie = "session=; path=/; max-age=0";
}
