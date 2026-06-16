import { type NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export type AuthResult =
  | { ok: true; uid: string; email: string | null }
  | { ok: false; response: NextResponse };

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
    return { ok: true, uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
}

export async function verifyApiTokenWithRole(
  req: NextRequest,
  requiredRoles: string[]
): Promise<AuthResult> {
  const auth = await verifyApiToken(req);
  if (!auth.ok) return auth;

  const userDoc = await getAdminDb().collection("users").doc(auth.uid).get();
  const data = userDoc.data();
  const roles: string[] = data?.roles ?? [];
  const status: string = data?.status ?? "";

  if (status !== "active" || !requiredRoles.some((r) => roles.includes(r))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return auth;
}
