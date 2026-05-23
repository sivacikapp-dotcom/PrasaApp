import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";

export async function POST(req: NextRequest) {
  const { voiceUrl } = (await req.json()) as { voiceUrl: string };
  if (!voiceUrl) {
    return NextResponse.json({ error: "voiceUrl is required" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  const audioRes = await fetch(voiceUrl);
  if (!audioRes.ok) {
    return NextResponse.json({ error: "Failed to fetch audio file" }, { status: 400 });
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
}
