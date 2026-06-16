import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { verifyApiToken, verifyApiTokenWithRole } from "@/lib/apiAuth";
import { notifyLimiter, checkRateLimit } from "@/lib/rateLimit";

const payloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("newContribution"),
    contributorName: z.string().max(300),
    eventDate: z.string().max(100),
  }),
  z.object({
    type: z.literal("newUser"),
    userName: z.string().max(300),
    userEmail: z.string().email().max(320),
  }),
]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function getEmailsByRole(role: string): Promise<string[]> {
  const { getAdminDb } = await import("@/lib/firebaseAdmin");
  const db = getAdminDb();
  const snap = await db.collection("users")
    .where("roles", "array-contains", role)
    .where("status", "==", "active")
    .get();
  return snap.docs
    .map((d) => (d.data().email as string) ?? "")
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  // Pre-parse type to decide which auth check to apply
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const payload = parsed.data;

  if (payload.type === "newUser") {
    // Nový používateľ sa práve zaregistroval — overíme len token a email
    const auth = await verifyApiToken(req);
    if (!auth.ok) return auth.response;

    // Email v payloade musí zodpovedať emailu v tokene
    if (auth.email !== payload.userEmail) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!await checkRateLimit(notifyLimiter, auth.uid)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  } else {
    // newContribution — musí mať rolu prispievateľa, kronikára alebo admina
    const auth = await verifyApiTokenWithRole(req, ["contributor", "chronicler", "admin"]);
    if (!auth.ok) return auth.response;

    if (!await checkRateLimit(notifyLimiter, auth.uid)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY nie je nastavený na serveri" }, { status: 500 });
    }

    const testEmail = process.env.RESEND_TEST_EMAIL;
    const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
    const resend = new Resend(apiKey);

    if (payload.type === "newContribution") {
      const { contributorName, eventDate } = payload;
      const to = testEmail ? [testEmail] : await getEmailsByRole("chronicler");
      if (to.length === 0) return NextResponse.json({ ok: true, skipped: "no chroniclers" });

      const { error } = await resend.emails.send({
        from,
        to,
        subject: "Nový príspevok v Kronika",
        html: `
          <p>Dobrý deň,</p>
          <p>Používateľ <strong>${escapeHtml(contributorName)}</strong> pridal nový príspevok (${escapeHtml(eventDate)}).</p>
          <p>Prihláste sa do aplikácie a skontrolujte príspevok.</p>
        `,
      });
      if (error) {
        console.error("[notify] Resend error", error);
        return NextResponse.json({ error: "Chyba odoslania e-mailu" }, { status: 500 });
      }
    }

    if (payload.type === "newUser") {
      const { userName, userEmail } = payload;
      const to = testEmail ? [testEmail] : await getEmailsByRole("admin");
      if (to.length === 0) return NextResponse.json({ ok: true, skipped: "no admins" });

      const { error } = await resend.emails.send({
        from,
        to,
        subject: "Nová žiadosť o prístup",
        html: `
          <p>Dobrý deň,</p>
          <p>Používateľ <strong>${escapeHtml(userName)}</strong> (${escapeHtml(userEmail)}) požiadal o prístup do Kronika.</p>
          <p>Prihláste sa do aplikácie a schváľte alebo zamietnte žiadosť.</p>
        `,
      });
      if (error) {
        console.error("[notify] Resend error", error);
        return NextResponse.json({ error: "Chyba odoslania e-mailu" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notify]", err);
    return NextResponse.json({ error: "Chyba odoslania notifikácie" }, { status: 500 });
  }
}
