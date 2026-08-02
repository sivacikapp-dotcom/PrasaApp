"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format, type Locale } from "date-fns";
import exifr from "exifr";
import { fetchFile } from "@ffmpeg/util";
import { loadFFmpeg } from "@/lib/ffmpeg";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { getAuthHeaders } from "@/lib/authHeaders";
import { getLocationName } from "@/lib/geocoding";
import { createContribution, updateContribution } from "@/lib/contributionService";
import { uploadPhoto, uploadVideo } from "@/lib/storageService";
import { createNotificationsForUsers } from "@/lib/notificationService";
import { Button } from "@/components/ui/Button";
import type { ChronicleEvent } from "@/types/contribution";

interface Props {
  event: ChronicleEvent;
}

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
// Windows Chromium (and others) often report an empty file.type for less common
// formats like .heic — extension is the only reliable fallback in that case.
const PHOTO_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

const GAP_MS = 15 * 60 * 1000; // 15 min
const DISTANCE_M = 500; // 500 m

type Kind = "photo" | "video";
type DataChoice = "suggested" | "edited" | "rejected";

interface AnalyzedFile {
  localId: string;
  file: File; // upload-ready (HEIC already converted to JPEG here)
  kind: Kind;
  previewUrl: string;
  timestamp: Date;
  timestampSource: "exif" | "filename" | "fallback";
  latitude: number | null;
  longitude: number | null;
}

interface Moment {
  localId: string;
  files: AnalyzedFile[];
  timestamp: Date;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  reviewed: boolean;
  dataChoice: DataChoice;
  editedDate: string; // datetime-local value
  editedLocationName: string;
}

// ── Geometry ─────────────────────────────────────────────────────────────────

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Filename fallback (same conventions as scripts/bulk-import-media.mjs) ──

const FILENAME_PATTERNS: { re: RegExp; build: (m: RegExpExecArray) => Date }[] = [
  { re: /(?:IMG|VID)-(\d{4})(\d{2})(\d{2})-WA\d+/i, build: (m) => new Date(+m[1], +m[2] - 1, +m[3]) },
  { re: /(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/, build: (m) => new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) },
];

function extractFilenameDate(filename: string): Date | null {
  for (const { re, build } of FILENAME_PATTERNS) {
    const m = re.exec(filename);
    if (m) {
      const d = build(m);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function mtimeIsPlausible(mtime: Date, event: ChronicleEvent): boolean {
  if (!event.dateFrom && !event.dateTo) return true;
  const bufferMs = 3 * 24 * 60 * 60 * 1000;
  const from = event.dateFrom ? event.dateFrom.getTime() - bufferMs : -Infinity;
  const to = event.dateTo
    ? event.dateTo.getTime() + bufferMs
    : event.dateFrom
    ? event.dateFrom.getTime() + bufferMs
    : Infinity;
  return mtime.getTime() >= from && mtime.getTime() <= to;
}

function eventFallbackDate(event: ChronicleEvent, fallback: Date): Date {
  if (event.dateFrom && event.dateTo) return new Date((event.dateFrom.getTime() + event.dateTo.getTime()) / 2);
  return event.dateFrom ?? event.dateTo ?? fallback;
}

// ── Metadata extraction ──────────────────────────────────────────────────────

function parseIso6709(str: string | undefined): { latitude: number; longitude: number } | null {
  if (!str) return null;
  // No ambiguous/nested repetition here (each optional group is fixed-count),
  // so this isn't actually susceptible to catastrophic backtracking — the
  // rule's static heuristic just flags "+ next to +" regardless.
  // eslint-disable-next-line security/detect-unsafe-regex
  const m = /^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/.exec(str.trim());
  if (!m) return null;
  return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
}

async function extractPhotoMetadata(file: File): Promise<{ timestamp: Date | null; latitude: number | null; longitude: number | null }> {
  try {
    const data = await exifr.parse(file, { gps: true });
    if (!data) return { timestamp: null, latitude: null, longitude: null };
    const date: unknown = data.DateTimeOriginal ?? data.CreateDate;
    const timestamp = date instanceof Date && !isNaN(date.getTime()) ? date : null;
    // (0, 0) is "null island" — some cameras write this when they never got a GPS fix
    const hasGps =
      typeof data.latitude === "number" && Number.isFinite(data.latitude) &&
      typeof data.longitude === "number" && Number.isFinite(data.longitude) &&
      !(data.latitude === 0 && data.longitude === 0);
    return { timestamp, latitude: hasGps ? data.latitude : null, longitude: hasGps ? data.longitude : null };
  } catch {
    return { timestamp: null, latitude: null, longitude: null };
  }
}

async function extractVideoMetadata(file: File): Promise<{ timestamp: Date | null; latitude: number | null; longitude: number | null }> {
  try {
    const ffmpeg = await loadFFmpeg();
    const logs: string[] = [];
    const onLog = ({ message }: { message: string }) => logs.push(message);
    ffmpeg.on("log", onLog);
    const ext = file.name.split(".").pop() ?? "mp4";
    const inputName = `probe_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    // "-i" with no output file makes ffmpeg dump container metadata to its log
    // and exit non-zero — exec() resolves with that exit code, it doesn't throw.
    await ffmpeg.exec(["-i", inputName]);
    ffmpeg.off("log", onLog);
    await ffmpeg.deleteFile(inputName);

    let timestamp: Date | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;
    for (const line of logs) {
      if (timestamp === null) {
        const m = /creation_time\s*:\s*([\d:TZ.-]+)/i.exec(line);
        if (m) {
          const d = new Date(m[1]);
          if (!isNaN(d.getTime())) timestamp = d;
        }
      }
      if (latitude === null && /location/i.test(line) && line.includes(":")) {
        const value = line.split(":").slice(1).join(":").trim();
        const parsed = parseIso6709(value);
        if (parsed) {
          latitude = parsed.latitude;
          longitude = parsed.longitude;
        }
      }
    }
    return { timestamp, latitude, longitude };
  } catch {
    return { timestamp: null, latitude: null, longitude: null };
  }
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/convert-heic", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error("HEIC conversion failed");
  const blob = await res.blob();
  const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

function detectKind(file: File): Kind {
  if (file.type.startsWith("video/") || VIDEO_TYPES.has(file.type) || VIDEO_EXT.test(file.name)) return "video";
  return "photo";
}

async function analyzeFile(rawFile: File, event: ChronicleEvent): Promise<AnalyzedFile> {
  const isHeic = HEIC_TYPES.has(rawFile.type) || /\.(heic|heif)$/i.test(rawFile.name);
  const kind: Kind = detectKind(rawFile);
  const file = isHeic ? await convertHeicToJpeg(rawFile) : rawFile;

  const meta = kind === "photo" ? await extractPhotoMetadata(rawFile) : await extractVideoMetadata(rawFile);
  let timestamp = meta.timestamp;
  let timestampSource: AnalyzedFile["timestampSource"] = "exif";

  if (!timestamp) {
    const fromName = extractFilenameDate(rawFile.name);
    if (fromName) {
      timestamp = fromName;
      timestampSource = "filename";
    }
  }
  if (!timestamp) {
    const mtime = new Date(rawFile.lastModified);
    if (mtimeIsPlausible(mtime, event)) {
      timestamp = mtime;
      // Reuses the "filename" confidence bucket for the UI badge — both are
      // weak, file-property-derived signals rather than embedded metadata.
      timestampSource = "filename";
    }
  }
  if (!timestamp) {
    timestamp = eventFallbackDate(event, new Date());
    timestampSource = "fallback";
  }

  return {
    localId: crypto.randomUUID(),
    file,
    kind,
    previewUrl: URL.createObjectURL(file),
    timestamp,
    timestampSource,
    latitude: meta.latitude,
    longitude: meta.longitude,
  };
}

// ── Clustering (time + distance, matches scripts/bulk-import-media.mjs plus GPS) ──

function clusterFiles(files: AnalyzedFile[]): AnalyzedFile[][] {
  const sorted = [...files].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const clusters: AnalyzedFile[][] = [];
  let current: AnalyzedFile[] | null = null;
  for (const f of sorted) {
    const last = current?.[current.length - 1];
    let sameMoment = false;
    if (last) {
      const withinTime = f.timestamp.getTime() - last.timestamp.getTime() <= GAP_MS;
      let withinDistance = true;
      if (last.latitude != null && last.longitude != null && f.latitude != null && f.longitude != null) {
        withinDistance = distanceMeters(last.latitude, last.longitude, f.latitude, f.longitude) <= DISTANCE_M;
      }
      sameMoment = withinTime && withinDistance;
    }
    if (!sameMoment) {
      current = [];
      clusters.push(current);
    }
    current!.push(f);
  }
  return clusters;
}

const geocodeCache = new Map<string, string | null>();
let lastGeocodeAt = 0;
async function reverseGeocodeRateLimited(lat: number, lon: number): Promise<string | null> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  const wait = 1100 - (Date.now() - lastGeocodeAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocodeAt = Date.now();
  const name = await getLocationName(lat, lon);
  geocodeCache.set(key, name);
  return name;
}

async function buildMoment(files: AnalyzedFile[], event: ChronicleEvent): Promise<Moment> {
  const withGps = files.find((f) => f.latitude != null && f.longitude != null);
  let locationName: string | null = event.locationName;
  if (withGps) {
    locationName = await reverseGeocodeRateLimited(withGps.latitude!, withGps.longitude!);
  }
  const timestamp = files[0].timestamp;
  return {
    localId: crypto.randomUUID(),
    files,
    timestamp,
    latitude: withGps?.latitude ?? null,
    longitude: withGps?.longitude ?? null,
    locationName,
    reviewed: false,
    dataChoice: "suggested",
    editedDate: toDatetimeLocalValue(timestamp),
    editedLocationName: locationName ?? "",
  };
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function resolveSubmission(moment: Moment, event: ChronicleEvent) {
  if (moment.dataChoice === "edited") {
    return {
      eventDate: new Date(moment.editedDate),
      location: null,
      locationName: moment.editedLocationName || null,
    };
  }
  if (moment.dataChoice === "rejected") {
    return {
      eventDate: eventFallbackDate(event, moment.timestamp),
      location: null,
      locationName: event.locationName,
    };
  }
  return {
    eventDate: moment.timestamp,
    location: moment.latitude != null && moment.longitude != null
      ? { latitude: moment.latitude, longitude: moment.longitude, accuracy: 0 }
      : null,
    locationName: moment.locationName,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export function BulkUploadReview({ event }: Props) {
  const { appUser } = useAuth();
  const { t, dateFnsLocale } = useI18n();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [moments, setMoments] = useState<Moment[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [analyzeTotal, setAnalyzeTotal] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter(
      (f) =>
        PHOTO_TYPES.has(f.type) || VIDEO_TYPES.has(f.type) ||
        f.type.startsWith("image/") || f.type.startsWith("video/") ||
        PHOTO_EXT.test(f.name) || VIDEO_EXT.test(f.name)
    );
    if (files.length === 0) return;

    setAnalyzing(true);
    setAnalyzeTotal(files.length);
    setAnalyzedCount(0);

    const analyzed: AnalyzedFile[] = [];
    for (const f of files) {
      analyzed.push(await analyzeFile(f, event));
      setAnalyzedCount((n) => n + 1);
    }

    // Re-cluster over everything selected so far (existing manual split/merge
    // decisions on already-reviewed moments are intentionally not preserved —
    // simplest predictable behaviour when adding more files afterward).
    const allFiles = [...moments.flatMap((m) => m.files), ...analyzed];
    const clusters = clusterFiles(allFiles);
    const built = await Promise.all(clusters.map((c) => buildMoment(c, event)));
    setMoments(built);
    setAnalyzing(false);
  }

  function updateMoment(id: string, patch: Partial<Moment>) {
    setMoments((prev) => prev.map((m) => (m.localId === id ? { ...m, ...patch } : m)));
  }

  function acceptAll() {
    setMoments((prev) => prev.map((m) => ({ ...m, reviewed: true, dataChoice: "suggested" })));
  }

  function accept(id: string) {
    updateMoment(id, { reviewed: true, dataChoice: "suggested" });
  }

  function reject(id: string) {
    updateMoment(id, { reviewed: true, dataChoice: "rejected" });
  }

  function saveEdit(id: string, date: string, locationName: string) {
    updateMoment(id, { reviewed: true, dataChoice: "edited", editedDate: date, editedLocationName: locationName });
    setEditingId(null);
  }

  function removeFile(momentId: string, fileLocalId: string) {
    setMoments((prev) =>
      prev
        .map((m) => (m.localId === momentId ? { ...m, files: m.files.filter((f) => f.localId !== fileLocalId) } : m))
        .filter((m) => m.files.length > 0)
    );
  }

  function splitFile(momentId: string, fileLocalId: string) {
    setMoments((prev) => {
      const moment = prev.find((m) => m.localId === momentId);
      const file = moment?.files.find((f) => f.localId === fileLocalId);
      if (!moment || !file || moment.files.length < 2) return prev;
      const remaining = moment.files.filter((f) => f.localId !== fileLocalId);
      const newMoment: Moment = {
        localId: crypto.randomUUID(),
        files: [file],
        timestamp: file.timestamp,
        latitude: file.latitude,
        longitude: file.longitude,
        locationName: moment.locationName,
        reviewed: false,
        dataChoice: "suggested",
        editedDate: toDatetimeLocalValue(file.timestamp),
        editedLocationName: moment.locationName ?? "",
      };
      const withoutOld = prev.map((m) => (m.localId === momentId ? { ...m, files: remaining, timestamp: remaining[0].timestamp } : m));
      return [...withoutOld, newMoment].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    });
  }

  function mergeWithNext(index: number) {
    setMoments((prev) => {
      if (index < 0 || index + 1 >= prev.length) return prev;
      const a = prev[index];
      const b = prev[index + 1];
      const files = [...a.files, ...b.files].sort((x, y) => x.timestamp.getTime() - y.timestamp.getTime());
      const merged: Moment = {
        ...a,
        files,
        timestamp: files[0].timestamp,
        reviewed: false,
        dataChoice: "suggested",
        editedDate: toDatetimeLocalValue(files[0].timestamp),
      };
      const next = [...prev];
      next.splice(index, 2, merged);
      return next;
    });
  }

  const allReviewed = moments.length > 0 && moments.every((m) => m.reviewed);

  async function handleSubmit() {
    if (!appUser || !allReviewed) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const contributionIds: string[] = [];
      for (const moment of moments) {
        const { eventDate, location, locationName } = resolveSubmission(moment, event);
        const contribId = await createContribution({
          contributorId: appUser.uid,
          contributorName: appUser.displayName,
          eventDate,
          texts: [],
          photoUrls: [],
          videoUrls: [],
          voices: [],
          location,
          locationName,
        });

        const photoUrls: string[] = [];
        const videoUrls: string[] = [];
        for (const f of moment.files) {
          if (f.kind === "photo") photoUrls.push(await uploadPhoto(f.file, contribId, appUser.uid));
          else videoUrls.push(await uploadVideo(f.file, contribId, appUser.uid));
        }
        await updateContribution(contribId, { photoUrls, videoUrls });
        contributionIds.push(contribId);
      }

      // Attaching to the event writes to the "events" collection, which
      // firestore.rules restricts to chroniclers/admins — a plain contributor
      // can't do this directly, so it's done server-side (with its own
      // bulkUploadContributorIds check) instead of via lib/eventService.ts.
      const attachHeaders = await getAuthHeaders();
      const attachRes = await fetch("/api/bulk-upload/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...attachHeaders },
        body: JSON.stringify({ eventId: event.id, contributionIds }),
      });
      if (!attachRes.ok) throw new Error("attach failed");

      const chroniclerIds = [...new Set([event.createdBy, ...event.editorIds])].filter((uid) => uid !== appUser.uid);
      createNotificationsForUsers(
        chroniclerIds.map((userId) => ({
          userId,
          type: "bulk_upload_submitted" as const,
          actorId: appUser.uid,
          actorName: appUser.displayName,
          actorPhotoURL: appUser.photoURL,
          eventId: event.id,
          eventTitle: event.title,
        }))
      );

      setSubmitted(true);
      setTimeout(() => router.push(`/events/${event.id}`), 2500);
    } catch {
      setSubmitError(t.bulkUpload.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-rim bg-surface p-6 text-center">
        <p className="text-success font-medium">{t.bulkUpload.submitSuccess}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFilesSelected(e.target.files);
          e.target.value = "";
        }}
      />

      {moments.length === 0 && !analyzing && (
        <div className="rounded-xl border border-dashed border-rim bg-surface p-8 text-center space-y-3">
          <p className="text-sm text-ink-subtle">{t.bulkUpload.emptyState}</p>
          <Button onClick={() => fileInputRef.current?.click()}>{t.bulkUpload.selectFilesBtn}</Button>
        </div>
      )}

      {analyzing && (
        <div className="rounded-xl border border-rim bg-surface p-4 text-center">
          <p className="text-sm text-ink-dim">{t.bulkUpload.analyzingStatus(analyzeTotal)}</p>
          <div className="mt-2 h-1.5 bg-surface-high rounded-full overflow-hidden">
            <div
              className="h-full bg-gold transition-all"
              style={{ width: `${analyzeTotal ? (analyzedCount / analyzeTotal) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {moments.length > 0 && !analyzing && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{t.bulkUpload.momentsHeading(moments.length)}</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-gold hover:text-gold/80 font-medium"
              >
                {t.bulkUpload.selectMoreBtn}
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="text-xs text-gold hover:text-gold/80 font-medium"
              >
                {t.bulkUpload.acceptAllBtn}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {moments.map((moment, index) => (
              <MomentCard
                key={moment.localId}
                moment={moment}
                isLast={index === moments.length - 1}
                editing={editingId === moment.localId}
                onEditStart={() => setEditingId(moment.localId)}
                onEditCancel={() => setEditingId(null)}
                onEditSave={(date, loc) => saveEdit(moment.localId, date, loc)}
                onAccept={() => accept(moment.localId)}
                onReject={() => reject(moment.localId)}
                onRemoveFile={(fid) => removeFile(moment.localId, fid)}
                onSplitFile={(fid) => splitFile(moment.localId, fid)}
                onMergeNext={() => mergeWithNext(index)}
                dateFnsLocale={dateFnsLocale}
              />
            ))}
          </div>

          {submitError && <p className="text-sm text-danger">{submitError}</p>}

          <div className="sticky bottom-4">
            <Button
              onClick={handleSubmit}
              disabled={!allReviewed || submitting}
              loading={submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? t.bulkUpload.submittingStatus : t.bulkUpload.submitBtn(moments.length)}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Moment card ──────────────────────────────────────────────────────────────

function MomentCard({
  moment,
  isLast,
  editing,
  onEditStart,
  onEditCancel,
  onEditSave,
  onAccept,
  onReject,
  onRemoveFile,
  onSplitFile,
  onMergeNext,
  dateFnsLocale,
}: {
  moment: Moment;
  isLast: boolean;
  editing: boolean;
  onEditStart: () => void;
  onEditCancel: () => void;
  onEditSave: (date: string, locationName: string) => void;
  onAccept: () => void;
  onReject: () => void;
  onRemoveFile: (fileLocalId: string) => void;
  onSplitFile: (fileLocalId: string) => void;
  onMergeNext: () => void;
  dateFnsLocale: Locale;
}) {
  const { t } = useI18n();
  const [editDate, setEditDate] = useState(moment.editedDate);
  const [editLoc, setEditLoc] = useState(moment.editedLocationName);

  const confidenceLabel =
    moment.files[0].timestampSource === "exif"
      ? t.bulkUpload.confidenceExif
      : moment.files[0].timestampSource === "filename"
      ? t.bulkUpload.confidenceFilename
      : t.bulkUpload.confidenceFallback;

  const statusColor =
    moment.dataChoice === "rejected"
      ? "border-danger"
      : moment.reviewed
      ? "border-success"
      : "border-rim";

  return (
    <div className={`rounded-xl border ${statusColor} bg-surface p-3 space-y-3`}>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {moment.files.map((f) => (
          <div key={f.localId} className="relative aspect-square rounded-lg overflow-hidden bg-surface-high group">
            {f.kind === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <video src={f.previewUrl} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => onRemoveFile(f.localId)}
              className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-ink opacity-0 group-hover:opacity-100"
            >
              <XIcon />
            </button>
            {moment.files.length > 1 && (
              <button
                type="button"
                onClick={() => onSplitFile(f.localId)}
                title={t.bulkUpload.splitBtn}
                className="absolute bottom-0.5 left-0.5 rounded-full bg-black/60 p-0.5 text-ink opacity-0 group-hover:opacity-100"
              >
                <SplitIcon />
              </button>
            )}
          </div>
        ))}
      </div>

      {!editing ? (
        <div className="text-xs space-y-1">
          <p className="text-ink">
            <span className="text-ink-subtle">{t.bulkUpload.momentTimeLabel}:</span>{" "}
            {format(moment.dataChoice === "edited" ? new Date(moment.editedDate) : moment.timestamp, "d.M.yyyy HH:mm", { locale: dateFnsLocale })}
          </p>
          <p className="text-ink">
            <span className="text-ink-subtle">{t.bulkUpload.momentLocationLabel}:</span>{" "}
            {moment.dataChoice === "edited" ? moment.editedLocationName : moment.locationName ?? "—"}
          </p>
          <p className="text-ink-subtle">({confidenceLabel})</p>
          {moment.dataChoice === "rejected" && <p className="text-danger">{t.bulkUpload.rejectedHint}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-xs text-ink-subtle">
            {t.bulkUpload.dateEditLabel}
            <input
              type="datetime-local"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-rim bg-surface px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <label className="block text-xs text-ink-subtle">
            {t.bulkUpload.locationEditLabel}
            <input
              type="text"
              value={editLoc}
              onChange={(e) => setEditLoc(e.target.value)}
              className="mt-1 w-full rounded-lg border border-rim bg-surface px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onEditSave(editDate, editLoc)}>{t.bulkUpload.saveEditBtn}</Button>
            <Button size="sm" variant="secondary" onClick={onEditCancel}>{t.bulkUpload.cancelEditBtn}</Button>
          </div>
        </div>
      )}

      {!editing && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={moment.dataChoice === "suggested" && moment.reviewed ? "primary" : "secondary"} onClick={onAccept}>
            {t.bulkUpload.acceptBtn}
          </Button>
          <Button size="sm" variant="secondary" onClick={onEditStart}>{t.bulkUpload.editBtn}</Button>
          <Button size="sm" variant={moment.dataChoice === "rejected" ? "danger" : "secondary"} onClick={onReject}>
            {t.bulkUpload.rejectBtn}
          </Button>
          {!isLast && (
            <Button size="sm" variant="ghost" onClick={onMergeNext}>{t.bulkUpload.mergeWithNextBtn}</Button>
          )}
        </div>
      )}
    </div>
  );
}

function XIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 4.586L2.707 1.293 1.293 2.707 4.586 6 1.293 9.293l1.414 1.414L6 7.414l3.293 3.293 1.414-1.414L7.414 6l3.293-3.293L9.293 1.293z" />
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M6 3v6l6 6v6M18 3v6l-6 6" />
    </svg>
  );
}
