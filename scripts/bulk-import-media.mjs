/**
 * Bulk-imports photos/videos from a local folder into an existing event as
 * "chronicler additions" (chroniclerPhotoUrls / chroniclerVideoUrls) — for
 * historical media that was never submitted through the app (WhatsApp
 * exports, a shared Google Drive folder, etc).
 *
 * Time/location per photo/video is derived with a fallback chain, because
 * WhatsApp strips EXIF/GPS on compression while Google Drive originals
 * usually keep it intact:
 *   1. EXIF (photos) / container metadata (videos)
 *   2. Filename convention (WhatsApp "IMG-YYYYMMDD-WAxxxx", Android/iOS
 *      "YYYYMMDD_HHMMSS")
 *   3. File mtime — only trusted if it falls near the event's date range
 *      (otherwise it's almost certainly a download/copy date, not a capture
 *      date, and is discarded in favour of the event fallback)
 *   4. The event's own dateFrom/dateTo midpoint and locationName
 *
 * Files are grouped into "moments" (bursts) by a configurable time gap —
 * each moment becomes one Contribution with multiple photos/videos.
 *
 * SETUP (once):
 *   1. Firebase Console → Project Settings → Service Accounts
 *   2. "Generate new private key" → save as  service-account.json  in project root
 *   3. service-account.json is already in .gitignore — never commit it!
 *   4. .env.local must contain NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *
 * USAGE:
 *   node scripts/bulk-import-media.mjs --event <eventId> --folder <path> --as <chronicler-email> [--gap-minutes 30] [--dry-run]
 *
 * EXAMPLES:
 *   node scripts/bulk-import-media.mjs --event abc123 --folder ./fotky --as jsivacik@gmail.com --dry-run
 *   node scripts/bulk-import-media.mjs --event abc123 --folder ./fotky --as jsivacik@gmail.com
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve, dirname, join, extname, basename } from "path";
import { fileURLToPath } from "url";
import { randomUUID, createHash } from "crypto";
import exifr from "exifr";
import ffmpeg from "fluent-ffmpeg";
import ffprobeStatic from "ffprobe-static";
import heicConvert from "heic-convert";

const __dirname = dirname(fileURLToPath(import.meta.url));
ffmpeg.setFfprobePath(ffprobeStatic.path);

// ── Env / Firebase init ──────────────────────────────────────────────────────

function loadEnvLocal() {
  const envPath = resolve(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const SA_PATH = resolve(__dirname, "..", "service-account.json");
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(SA_PATH, "utf-8"));
} catch {
  console.error("❌  service-account.json not found at:", SA_PATH);
  console.error("   Download it from Firebase Console → Project Settings → Service Accounts");
  process.exit(1);
}

const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
if (!bucketName) {
  console.error("❌  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set in .env.local");
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount), storageBucket: bucketName });
const db = getFirestore();
const auth = getAuth();
const bucket = getStorage().bucket();

// ── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { gapMinutes: 30, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--event") args.eventId = argv[++i];
    else if (a === "--folder") args.folder = argv[++i];
    else if (a === "--as") args.asEmail = argv[++i];
    else if (a === "--gap-minutes") args.gapMinutes = Number(argv[++i]);
    else if (a === "--dry-run") args.dryRun = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

function printUsageAndExit() {
  console.error("Usage: node scripts/bulk-import-media.mjs --event <eventId> --folder <path> --as <chronicler-email> [--gap-minutes 30] [--dry-run]");
  process.exit(1);
}

if (!args.eventId || !args.folder || !args.asEmail) printUsageAndExit();
if (!existsSync(args.folder)) {
  console.error(`❌  Priečinok neexistuje: ${args.folder}`);
  process.exit(1);
}

// ── File type / metadata constants ──────────────────────────────────────────

const PHOTO_MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".heic": "image/heic", ".heif": "image/heif" };
const VIDEO_MIME = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm" };
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

const FILENAME_PATTERNS = [
  // WhatsApp: IMG-20260215-WA0007.jpg / VID-20260215-WA0007.mp4
  { re: /(?:IMG|VID)-(\d{4})(\d{2})(\d{2})-WA\d+/i, build: (m) => new Date(+m[1], +m[2] - 1, +m[3]) },
  // Android/iOS: YYYYMMDD_HHMMSS
  { re: /(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/, build: (m) => new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) },
];

// ── Metadata extraction ──────────────────────────────────────────────────────

function parseIso6709(str) {
  if (!str) return null;
  const m = /^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/.exec(str);
  if (!m) return null;
  return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
}

async function extractPhotoMetadata(filePath) {
  try {
    // NOTE: don't pass `pick` here — exifr silently drops the computed
    // latitude/longitude output unless the raw GPS tag names are *also*
    // listed in `pick`, which defeats the point of a short pick list.
    // Parsing the full block is cheap enough for a one-off import script.
    const data = await exifr.parse(filePath, { gps: true });
    if (!data) return {};
    const date = data.DateTimeOriginal ?? data.CreateDate ?? null;
    const result = {};
    if (date instanceof Date && !isNaN(date.getTime())) {
      result.timestamp = date;
      result.timestampSource = "exif";
    }
    // (0, 0) is "null island" — some cameras/drones write this when they
    // never got a GPS fix, so treat it the same as missing GPS.
    if (
      typeof data.latitude === "number" && Number.isFinite(data.latitude) &&
      typeof data.longitude === "number" && Number.isFinite(data.longitude) &&
      !(data.latitude === 0 && data.longitude === 0)
    ) {
      result.latitude = data.latitude;
      result.longitude = data.longitude;
    }
    return result;
  } catch {
    return {};
  }
}

function ffprobeAsync(filePath) {
  return new Promise((resolveP) => {
    ffmpeg.ffprobe(filePath, (err, data) => resolveP(err ? null : data));
  });
}

async function extractVideoMetadata(filePath) {
  const data = await ffprobeAsync(filePath);
  const tags = data?.format?.tags ?? {};
  const result = {};
  const creation = tags.creation_time ?? tags["com.apple.quicktime.creationdate"];
  if (creation) {
    const d = new Date(creation);
    if (!isNaN(d.getTime())) {
      result.timestamp = d;
      result.timestampSource = "video-metadata";
    }
  }
  const parsed = parseIso6709(tags["com.apple.quicktime.location.ISO6709"] ?? tags.location);
  if (parsed) {
    result.latitude = parsed.latitude;
    result.longitude = parsed.longitude;
  }
  return result;
}

function extractFilenameDate(filename) {
  for (const { re, build } of FILENAME_PATTERNS) {
    const m = re.exec(filename);
    if (m) {
      const d = build(m);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

// Trust file mtime only if it falls near the event's own date range —
// otherwise it's almost certainly a WhatsApp/Drive download date, not the
// moment the photo/video was actually captured.
function mtimeIsPlausible(mtime, event) {
  if (!event.dateFrom && !event.dateTo) return true; // nothing to validate against
  const bufferMs = 3 * 24 * 60 * 60 * 1000; // 3-day grace window
  const from = event.dateFrom ? event.dateFrom.getTime() - bufferMs : -Infinity;
  const to = event.dateTo ? event.dateTo.getTime() + bufferMs : (event.dateFrom ? event.dateFrom.getTime() + bufferMs : Infinity);
  return mtime.getTime() >= from && mtime.getTime() <= to;
}

async function analyzeFile(filePath, kind, event) {
  const meta = kind === "photo" ? await extractPhotoMetadata(filePath) : await extractVideoMetadata(filePath);
  let timestamp = meta.timestamp ?? null;
  let timestampSource = meta.timestampSource ?? null;

  if (!timestamp) {
    const fromName = extractFilenameDate(basename(filePath));
    if (fromName) {
      timestamp = fromName;
      timestampSource = "filename";
    }
  }

  if (!timestamp) {
    const mtime = statSync(filePath).mtime;
    if (mtimeIsPlausible(mtime, event)) {
      timestamp = mtime;
      timestampSource = "file-mtime";
    }
  }

  if (!timestamp) {
    const fallback = event.dateFrom && event.dateTo
      ? new Date((event.dateFrom.getTime() + event.dateTo.getTime()) / 2)
      : (event.dateFrom ?? event.dateTo);
    if (!fallback) {
      throw new Error(
        `Nepodarilo sa určiť čas pre "${basename(filePath)}" a event nemá nastavený dateFrom/dateTo na fallback.`
      );
    }
    timestamp = fallback;
    timestampSource = "event-fallback";
  }

  return {
    kind,
    filePath,
    fileName: basename(filePath),
    timestamp,
    timestampSource,
    latitude: meta.latitude ?? null,
    longitude: meta.longitude ?? null,
  };
}

// ── Clustering ───────────────────────────────────────────────────────────────

function clusterFiles(files, gapMinutes) {
  const sorted = [...files].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const clusters = [];
  let current = null;
  for (const f of sorted) {
    const last = current?.[current.length - 1];
    if (!current || f.timestamp.getTime() - last.timestamp.getTime() > gapMinutes * 60 * 1000) {
      current = [];
      clusters.push(current);
    }
    current.push(f);
  }
  return clusters;
}

// ── Reverse geocoding (ported from lib/geocoding.ts — plain Node scripts
// can't import .ts modules directly, so this is kept manually in sync) ──────

async function getLocationName(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "PrasaApp/1.0 (+sivacikapp@gmail.com)",
        "Accept-Language": "sk,cs;q=0.8,en;q=0.5",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address;
    if (!addr) return data.display_name ?? null;
    const road = addr.road ?? addr.pedestrian ?? addr.footway ?? addr.path ?? null;
    const place = addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? addr.suburb ?? addr.county ?? null;
    if (road && place) return `${road}, ${place}`;
    if (place) return place;
    if (road) return road;
    return data.display_name ?? null;
  } catch {
    return null;
  }
}

const geocodeCache = new Map();
let lastGeocodeAt = 0;
async function reverseGeocodeRateLimited(lat, lon) {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  const wait = 1100 - (Date.now() - lastGeocodeAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocodeAt = Date.now();
  const name = await getLocationName(lat, lon);
  geocodeCache.set(key, name);
  return name;
}

// ── Dedup manifest ───────────────────────────────────────────────────────────

const MANIFEST_DIR = resolve(__dirname, "..", ".import-manifest");
function manifestPath(eventId) {
  return join(MANIFEST_DIR, `${eventId}.json`);
}
function loadManifest(eventId) {
  const p = manifestPath(eventId);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return {};
  }
}
function saveManifest(eventId, manifest) {
  mkdirSync(MANIFEST_DIR, { recursive: true });
  writeFileSync(manifestPath(eventId), JSON.stringify(manifest, null, 2));
}
function hashFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

// ── Storage upload ───────────────────────────────────────────────────────────

function buildDownloadUrl(path, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

const HEIC_EXT = new Set([".heic", ".heif"]);

async function uploadToChronicler(filePath, contributionId, kind, index) {
  let ext = extname(filePath).toLowerCase();
  let contentType = kind === "photo" ? PHOTO_MIME[ext] : VIDEO_MIME[ext];
  const maxBytes = kind === "photo" ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES;

  let buffer = readFileSync(filePath);
  if (kind === "photo" && HEIC_EXT.has(ext)) {
    // Every browser except Safari fails to render HEIC in an <img> tag, so
    // imported HEIC photos would silently look "empty" in the app — convert
    // to JPEG here instead. EXIF is already extracted separately, so nothing
    // is lost by not preserving it in the converted copy.
    buffer = Buffer.from(await heicConvert({ buffer, format: "JPEG", quality: 0.9 }));
    ext = ".jpg";
    contentType = "image/jpeg";
  }

  if (buffer.length > maxBytes) {
    throw new Error(`súbor je príliš veľký (${Math.round(buffer.length / 1024 / 1024)} MB)`);
  }
  const token = randomUUID();
  const storagePath = `chronicler/${contributionId}/${kind === "photo" ? "photos" : "videos"}/${Date.now()}_${index}${ext}`;
  await bucket.file(storagePath).save(buffer, {
    metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } },
  });
  return buildDownloadUrl(storagePath, token);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Resolve chronicler identity
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(args.asEmail);
  } catch {
    console.error(`❌  Používateľ "${args.asEmail}" nebol nájdený v Firebase Auth.`);
    process.exit(1);
  }
  const chroniclerUid = userRecord.uid;
  const userDoc = await db.collection("users").doc(chroniclerUid).get();
  const chroniclerName = (userDoc.data()?.displayName) ?? userRecord.displayName ?? args.asEmail;

  // Resolve event
  const eventSnap = await db.collection("events").doc(args.eventId).get();
  if (!eventSnap.exists) {
    console.error(`❌  Event "${args.eventId}" neexistuje.`);
    process.exit(1);
  }
  const eventData = eventSnap.data();
  const event = {
    locationName: eventData.locationName ?? null,
    dateFrom: eventData.dateFrom ? eventData.dateFrom.toDate() : null,
    dateTo: eventData.dateTo ? eventData.dateTo.toDate() : null,
    categoryId: eventData.categoryId ?? null,
  };

  let categoryAllowedUserIds = [];
  if (event.categoryId) {
    const catSnap = await db.collection("categories").doc(event.categoryId).get();
    categoryAllowedUserIds = catSnap.exists ? (catSnap.data().allowedUserIds ?? []) : [];
  }

  // Scan folder
  const entries = readdirSync(args.folder, { withFileTypes: true }).filter((e) => e.isFile());
  const files = [];
  for (const entry of entries) {
    const filePath = join(args.folder, entry.name);
    const ext = extname(entry.name).toLowerCase();
    if (PHOTO_MIME[ext]) files.push({ filePath, kind: "photo" });
    else if (VIDEO_MIME[ext]) files.push({ filePath, kind: "video" });
    else console.log(`⚠️  Preskakujem nepodporovaný súbor: ${entry.name}`);
  }
  if (files.length === 0) {
    console.log("Žiadne podporované fotky/videá v priečinku.");
    return;
  }

  // Dedup against manifest
  const manifest = loadManifest(args.eventId);
  const toProcess = [];
  let skippedDup = 0;
  for (const f of files) {
    const hash = hashFile(f.filePath);
    if (manifest[hash]) {
      skippedDup++;
      continue;
    }
    toProcess.push({ ...f, hash });
  }
  console.log(`Nájdených ${files.length} súborov, ${skippedDup} už predtým importovaných (preskakujem), ${toProcess.length} na spracovanie.\n`);
  if (toProcess.length === 0) return;

  // Analyze metadata
  const analyzed = [];
  for (const f of toProcess) {
    console.log(`Analyzujem ${f.fileName ?? basename(f.filePath)}...`);
    const meta = await analyzeFile(f.filePath, f.kind, event);
    analyzed.push({ ...f, ...meta });
  }

  // Cluster into moments
  const clusters = clusterFiles(analyzed, args.gapMinutes);

  // Resolve location per cluster
  const clusterSummaries = [];
  for (const cluster of clusters) {
    const withGps = cluster.find((f) => f.latitude != null && f.longitude != null);
    let latitude = null, longitude = null, locationName = null, locationSource = "event";
    if (withGps) {
      latitude = withGps.latitude;
      longitude = withGps.longitude;
      locationName = await reverseGeocodeRateLimited(latitude, longitude);
      locationSource = "gps";
    } else {
      locationName = event.locationName;
    }
    const timestamp = cluster[0].timestamp; // earliest in cluster
    clusterSummaries.push({ files: cluster, timestamp, latitude, longitude, locationName, locationSource });
  }

  // Print plan
  console.log(`\n${clusterSummaries.length} zhlukov ("momentov"):\n`);
  clusterSummaries.forEach((c, i) => {
    console.log(`[${i + 1}] ${c.timestamp.toLocaleString("sk-SK")} — ${c.files.length} súborov`);
    console.log(`    Lokácia: ${c.locationName ?? "—"} (zdroj: ${c.locationSource})`);
    for (const f of c.files) {
      console.log(`      - ${f.fileName} (${f.kind}, čas: ${f.timestampSource})`);
    }
  });

  if (args.dryRun) {
    console.log("\n--dry-run: nič sa nezapísalo do Firestore/Storage.");
    return;
  }

  // Write: create contribution per cluster, upload media, attach to event
  const visibleToIds = [...new Set([chroniclerUid, ...categoryAllowedUserIds])];
  const newContributionIds = [];
  let uploadedPhotos = 0, uploadedVideos = 0;

  for (const c of clusterSummaries) {
    const docRef = await db.collection("contributions").add({
      contributorId: chroniclerUid,
      contributorName: chroniclerName,
      eventDate: c.timestamp,
      texts: [],
      photoUrls: [],
      videoUrls: [],
      voices: [],
      recordedAt: c.timestamp,
      location: c.latitude != null ? { latitude: c.latitude, longitude: c.longitude, accuracy: 0 } : null,
      locationName: c.locationName,
      verifiedEventDate: null,
      chroniclerText: null,
      chroniclerVoiceUrl: null,
      chroniclerPhotoUrls: [],
      chroniclerVideoUrls: [],
      chroniclerVoiceTranscript: null,
      categories: [],
      hashtags: [],
      eventGroupIds: [],
      status: "processed",
      deletedAt: null,
      deletedBy: null,
      visibleToIds,
      taggedUserIds: [],
      directEventId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const chroniclerPhotoUrls = [];
    const chroniclerVideoUrls = [];
    for (let i = 0; i < c.files.length; i++) {
      const f = c.files[i];
      try {
        const url = await uploadToChronicler(f.filePath, docRef.id, f.kind, i);
        if (f.kind === "photo") { chroniclerPhotoUrls.push(url); uploadedPhotos++; }
        else { chroniclerVideoUrls.push(url); uploadedVideos++; }
        manifest[f.hash] = { contributionId: docRef.id, importedAt: new Date().toISOString() };
      } catch (err) {
        console.error(`❌  Nepodarilo sa nahrať ${f.fileName}: ${err.message}`);
      }
    }

    await docRef.update({ chroniclerPhotoUrls, chroniclerVideoUrls, updatedAt: new Date() });
    newContributionIds.push(docRef.id);
    console.log(`✓  Vytvorený príspevok ${docRef.id} (${chroniclerPhotoUrls.length} fotiek, ${chroniclerVideoUrls.length} videí)`);
  }

  await db.collection("events").doc(args.eventId).update({
    contributionIds: FieldValue.arrayUnion(...newContributionIds),
    updatedAt: new Date(),
  });

  saveManifest(args.eventId, manifest);

  console.log(`\n✓  Hotovo: ${newContributionIds.length} nových príspevkov, ${uploadedPhotos} fotiek, ${uploadedVideos} videí.`);
}

main().catch((err) => {
  console.error("❌  Error:", err.message);
  process.exit(1);
});
