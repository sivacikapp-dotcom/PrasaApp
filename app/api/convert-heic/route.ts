import { NextRequest, NextResponse } from "next/server";
import heicConvert from "heic-convert";
import { verifyApiToken } from "@/lib/apiAuth";
import { convertHeicLimiter, checkRateLimit } from "@/lib/rateLimit";

// Matches storageService.ts's MAX_PHOTO_BYTES — HEIC photos go through this
// same size ceiling before they ever reach Storage.
const MAX_BYTES = 20 * 1024 * 1024;

// heic-convert has no browser build; this route lets the bulk-upload flow
// (components/BulkUploadReview.tsx) get a JPEG preview + storable copy of
// HEIC/HEIF photos without shipping a second, unproven WASM decoder to the client.
export async function POST(req: NextRequest) {
  const auth = await verifyApiToken(req);
  if (!auth.ok) return auth.response;

  if (!await checkRateLimit(convertHeicLimiter, auth.uid)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const buffer = Buffer.from(await req.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: "Prázdne telo požiadavky" }, { status: 400 });
    }
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "Súbor je príliš veľký" }, { status: 413 });
    }

    const output = await heicConvert({ buffer, format: "JPEG", quality: 0.9 });

    return new NextResponse(Buffer.from(output), {
      status: 200,
      headers: { "Content-Type": "image/jpeg" },
    });
  } catch (err) {
    console.error("[convert-heic]", err);
    return NextResponse.json({ error: "Nepodarilo sa konvertovať HEIC súbor" }, { status: 500 });
  }
}
