import { NextRequest, NextResponse } from "next/server";

interface PushPayload {
  tokens: string[];
  type: string;
  actorName?: string;
  eventTitle?: string;
  categoryName?: string;
  extraUserName?: string;
}

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
    default:
      return "Nová notifikácia z Kroniky";
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json() as PushPayload;

    if (!payload.tokens?.length) {
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
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
