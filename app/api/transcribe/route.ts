import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { z } from "zod";
import { verifyApiToken } from "@/lib/apiAuth";
import { transcribeLimiter, checkRateLimit } from "@/lib/rateLimit";

// Voice recordings can be up to 3 minutes; fetching + Whisper transcription
// can exceed the platform's default serverless timeout, so raise it.
export const maxDuration = 60;

const ALLOWED_STORAGE_ORIGINS = [
  "https://firebasestorage.googleapis.com",
  ...(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    ? [`https://${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}`]
    : []),
];

const payloadSchema = z.object({
  voiceUrl: z.string().url().max(2048),
});

export async function POST(req: NextRequest) {
  const auth = await verifyApiToken(req);
  if (!auth.ok) return auth.response;

  if (!await checkRateLimit(transcribeLimiter, auth.uid, true)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const parsed = payloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "voiceUrl is required and must be a valid URL" }, { status: 400 });
    }
    const { voiceUrl } = parsed.data;

    // SSRF guard: only allow Firebase Storage URLs
    const isAllowed = ALLOWED_STORAGE_ORIGINS.some((origin) => voiceUrl.startsWith(origin));
    if (!isAllowed) {
      return NextResponse.json({ error: "URL nie je povolená" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY nie je nastavený na serveri" }, { status: 500 });
    }

    const audioRes = await fetch(voiceUrl);
    if (!audioRes.ok) {
      return NextResponse.json({ error: `Nepodarilo sa načítať audio: ${audioRes.status} ${audioRes.statusText}` }, { status: 400 });
    }

    const buffer = Buffer.from(await audioRes.arrayBuffer());
    const contentType = audioRes.headers.get("content-type") ?? "audio/webm";
    const ext = contentType.includes("mp4") ? "mp4" : "webm";

    const client = new OpenAI({ apiKey });
    const file = await toFile(buffer, `audio.${ext}`, { type: contentType });

    const { text } = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "sk",
    });

    return NextResponse.json({ transcript: text });
  } catch (err) {
    console.error("[transcribe]", err);
    return NextResponse.json({ error: "Chyba prepisu" }, { status: 500 });
  }
}
