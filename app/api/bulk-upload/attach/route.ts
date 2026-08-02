import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { verifyApiToken } from "@/lib/apiAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { bulkUploadAttachLimiter, checkRateLimit } from "@/lib/rateLimit";

// firestore.rules only lets chroniclers/admins write to the "events" collection,
// so a plain contributor's browser can't attach their own bulk-uploaded
// contributions to an event directly. This route does that attach step
// server-side (admin SDK bypasses rules) after independently checking the
// caller is actually listed in the event's bulkUploadContributorIds — the
// same authorization the Firestore rule would represent, just enforced here
// instead of in a hand-written security rule.
const payloadSchema = z.object({
  eventId: z.string().min(1).max(200),
  contributionIds: z.array(z.string().min(1).max(200)).min(1).max(100),
});

export async function POST(req: NextRequest) {
  const auth = await verifyApiToken(req);
  if (!auth.ok) return auth.response;

  if (!await checkRateLimit(bulkUploadAttachLimiter, auth.uid)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = payloadSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { eventId, contributionIds } = parsed.data;

  try {
    const db = getAdminDb();

    const eventRef = db.collection("events").doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const eventData = eventSnap.data()!;
    const bulkUploadContributorIds: string[] = eventData.bulkUploadContributorIds ?? [];

    const callerSnap = await db.collection("users").doc(auth.uid).get();
    const callerRoles: string[] = callerSnap.data()?.roles ?? [];
    const isPrivileged = callerRoles.includes("chronicler") || callerRoles.includes("admin");
    if (!isPrivileged && !bulkUploadContributorIds.includes(auth.uid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only attach contributions that actually belong to the caller — defensive,
    // prevents attaching someone else's doc IDs even if somehow supplied.
    const contribRefs = contributionIds.map((id) => db.collection("contributions").doc(id));
    const contribSnaps = await db.getAll(...contribRefs);
    const ownSnaps = contribSnaps.filter((s) => s.exists && s.data()!.contributorId === auth.uid);
    if (ownSnaps.length === 0) {
      return NextResponse.json({ error: "No valid contributions to attach" }, { status: 400 });
    }

    const current: string[] = eventData.contributionIds ?? [];
    const toAdd = ownSnaps.map((s) => s.id).filter((id) => !current.includes(id));

    let allowedUserIds: string[] = [];
    let categoryName = "";
    const categoryId: string | null = eventData.categoryId ?? null;
    if (categoryId) {
      const catSnap = await db.collection("categories").doc(categoryId).get();
      if (catSnap.exists) {
        allowedUserIds = (catSnap.data()!.allowedUserIds as string[]) ?? [];
        categoryName = (catSnap.data()!.name as string) ?? "";
      }
    }

    const batch = db.batch();
    if (toAdd.length > 0) {
      batch.update(eventRef, {
        contributionIds: FieldValue.arrayUnion(...toAdd),
        updatedAt: new Date(),
      });
    }
    for (const snap of ownSnaps) {
      const existingVisible = (snap.data()!.visibleToIds as string[]) ?? [];
      const merged = [...new Set([...existingVisible, ...allowedUserIds])];
      batch.update(snap.ref, { status: "processed", visibleToIds: merged, updatedAt: new Date() });
    }
    await batch.commit();

    // Mirrors the "contribution_processed" notification lib/eventService.ts's
    // addContributionsToEvent sends to category members (in-app only — sending
    // a push here would need its own FCM call, skipped for now).
    if (allowedUserIds.length > 0) {
      const actorName = (callerSnap.data()?.displayName as string) ?? "";
      const actorPhotoURL = (callerSnap.data()?.photoURL as string | null) ?? null;
      const memberIds = allowedUserIds.filter((uid) => uid !== auth.uid);
      await Promise.all(
        memberIds.map(async (userId) => {
          const userSnap = await db.collection("users").doc(userId).get();
          const settings = (userSnap.data()?.notificationSettings ?? {}) as Record<string, string>;
          if (settings.contribution_processed === "off") return;
          await db.collection("notifications").add({
            userId,
            type: "contribution_processed",
            actorId: auth.uid,
            actorName,
            actorPhotoURL,
            eventId,
            eventTitle: (eventData.title as string) ?? "",
            categoryId,
            categoryName,
            read: false,
            createdAt: new Date(),
          });
        })
      );
    }

    return NextResponse.json({ ok: true, attached: ownSnaps.length });
  } catch (err) {
    console.error("[bulk-upload/attach]", err);
    return NextResponse.json({ error: "Nepodarilo sa priradiť príspevky k udalosti" }, { status: 500 });
  }
}
