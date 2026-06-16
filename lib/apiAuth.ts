import { type NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export type AuthResult =
  | { ok: true; uid: string }
  | { ok: false; response: NextResponse };

/**
 * Verifies the Firebase ID token from the Authorization: Bearer <token> header.
 * Usage in a route handler:
 *   const auth = await verifyApiToken(req);
 *   if (!auth.ok) return auth.response;
 */
export async function verifyApiToken(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return { ok: true, uid: decoded.uid };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
}
