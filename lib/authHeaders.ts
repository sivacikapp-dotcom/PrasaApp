import { auth } from "@/lib/firebase";

/**
 * Returns Authorization: Bearer <token> header for authenticated API calls.
 * Returns empty object if no user is signed in (should not happen in normal flow).
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}
