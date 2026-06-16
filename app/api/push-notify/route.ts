import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiTokenWithRole } from "@/lib/apiAuth";
import { pushNotifyLimiter, checkRateLimit } from "@/lib/rateLimit";

const MAX_TOKENS = 100;

const payloadSchema = z.object({
  tokens: z.array(z.string().max(512)).max(MAX_TOKENS),
  type: z.string().max(100),
  actorName: z.string().max(300).optional(),
  eventTitle: z.string().max(500).optional(),
  categoryName: z.string().max(300).optional(),
  extraUserName: z.string().max(300).optional(),
});

type PushPayload = z.infer<typeof payloadSchema>;

function buildBody(payload: PushPayload): string {
  const { type, actorName, eventTitle, categoryName, extraUserName } = payload;
  switch (type) {
    case "user_tagged":
      return actorName ? `${actorName} vás označil v príspevku` : "Boli ste označený v príspevku";
    case "contribution_added_to_event":
      return eventTitle ? `Váš príspevok bol zaradený do udalosti „${eventTitle}"` : "Váš príspevok bol zaradený do udalosti";
    case "contribution_removed_from_event":
      return eventTitle ? `Váš príspevok bol vyradený z udalosti „${eventTitle}"` : "Váš príspevok bol vyradený z udalosti";
    case "contribution_deleted":
      return actorName ? `${actorName} vymazal váš príspevok` : "Váš príspevok bol vymazaný";
    case "event_created":
      return eventTitle ? `Nová udalosť vo vašej skupine: „${eventTitle}"` : "Bola vytvorená nová udalosť";
    case "user_added_to_group":
      return extraUserName && categoryName
        ? `${extraUserName} bol pridaný do skupiny „${categoryName}"`
        : "Do vašej skupiny bol pridaný nový člen";
    case "user_removed_from_group":
      return extraUserName && categoryName
        ? `${extraUserName} bol odobratý zo skupiny „${categoryName}"`
        : "Člen opustil vašu skupinu";
    case "contribution_processed":
      return categoryName
        ? `Nový spracovaný príspevok v skupine „${categoryName}"`
        : "Nový spracovaný príspevok vo vašej skupine";
    case "access_request":
      return actorName ? `${actorName} požiadal o prístup do aplikácie` : "Nová žiadosť o prístup do aplikácie";
    default:
      return "Nová notifikácia z Kroniky";
  }
}

export async function POST(req: NextRequest) {
  // Len kronikár alebo admin môže posielať push notifikácie
  const auth = await verifyApiTokenWithRole(req, ["chronicler", "admin"]);
  if (!auth.ok) return auth.response;

  if (!await checkRateLimit(pushNotifyLimiter, auth.uid)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const parsed = payloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const payload = parsed.data;

    if (!payload.tokens.length) {
      return NextResponse.json({ ok: true, skipped: "no tokens" });
    }

    const { getAdminMessaging } = await import("@/lib/firebaseAdmin");
    const messaging = getAdminMessaging();

    const result = await messaging.sendEachForMulticast({
      tokens: payload.tokens,
      notification: {
        title: "Kronika",
        body: buildBody(payload),
      },
      data: { type: payload.type },
      webpush: {
        notification: {
          icon: "/icon-192.png",
          badge: "/icon-192.png",
        },
      },
    });

    return NextResponse.json({ ok: true, successCount: result.successCount });
  } catch (err) {
    console.error("[push-notify]", err);
    return NextResponse.json({ error: "Chyba odoslania push notifikácie" }, { status: 500 });
  }
}
