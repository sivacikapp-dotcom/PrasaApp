import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminDb } from "@/lib/firebaseAdmin";

type NotifyPayload =
  | { type: "newContribution"; contributorName: string; eventDate: string }
  | { type: "newUser"; userName: string; userEmail: string };

async function getEmailsByRole(role: string): Promise<string[]> {
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
  try {
    const payload = await req.json() as NotifyPayload;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY nie je nastavený na serveri" }, { status: 500 });
    }

    const from = process.env.RESEND_FROM_EMAIL ?? "PrasaApp <noreply@prasaapp.sk>";
    const resend = new Resend(apiKey);

    if (payload.type === "newContribution") {
      const { contributorName, eventDate } = payload;
      const to = await getEmailsByRole("chronicler");
      if (to.length === 0) return NextResponse.json({ ok: true, skipped: "no chroniclers" });

      const { error } = await resend.emails.send({
        from,
        to,
        subject: "Nový príspevok v Kronika",
        html: `
          <p>Dobrý deň,</p>
          <p>Používateľ <strong>${contributorName}</strong> pridal nový príspevok (${eventDate}).</p>
          <p>Prihláste sa do aplikácie a skontrolujte príspevok.</p>
        `,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (payload.type === "newUser") {
      const { userName, userEmail } = payload;
      const to = await getEmailsByRole("admin");
      if (to.length === 0) return NextResponse.json({ ok: true, skipped: "no admins" });

      const { error } = await resend.emails.send({
        from,
        to,
        subject: "Nová žiadosť o prístup",
        html: `
          <p>Dobrý deň,</p>
          <p>Používateľ <strong>${userName}</strong> (${userEmail}) požiadal o prístup do Kronika.</p>
          <p>Prihláste sa do aplikácie a schváľte alebo zamietnte žiadosť.</p>
        `,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
