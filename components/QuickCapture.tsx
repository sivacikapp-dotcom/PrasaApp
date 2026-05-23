"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "@/hooks/useLocation";
import { createContribution, updateContribution } from "@/lib/contributionService";
import { uploadPhoto, uploadVoice } from "@/lib/storageService";
import { getLocationName } from "@/lib/geocoding";
import { savePending } from "@/lib/offlineDb";

type CaptureStatus = "idle" | "uploading" | "success" | "offline" | "error";

function pickMimeType(): string {
  const candidates = [
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function fmtTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function QuickCapture() {
  const { appUser } = useAuth();
  const { state: locState, capture: captureLocation } = useLocation();

  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>("idle");
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);

  const cameraRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Silently acquire GPS when component mounts
  useEffect(() => {
    captureLocation();
  }, [captureLocation]);

  const getLocation = useCallback(() => {
    return locState.status === "ok" ? locState.data : null;
  }, [locState]);

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !appUser) return;

    setCaptureStatus("uploading");
    try {
      const loc = getLocation();
      if (!navigator.onLine) {
        await savePending({
          id: crypto.randomUUID(),
          contributorId: appUser.uid,
          contributorName: appUser.displayName,
          eventDate: new Date().toISOString(),
          texts: [],
          location: loc,
          locationName: null,
          photoBlobs: [file],
          videoBlobs: [],
          voiceBlobs: [],
          createdAt: new Date().toISOString(),
        });
        setCaptureStatus("offline");
      } else {
        const locationName = loc ? await getLocationName(loc.latitude, loc.longitude) : null;
        const contribId = await createContribution({
          contributorId: appUser.uid,
          contributorName: appUser.displayName,
          eventDate: new Date(),
          texts: [],
          photoUrls: [],
          videoUrls: [],
          voices: [],
          location: loc,
          locationName,
        });
        const photoUrl = await uploadPhoto(file, contribId, appUser.uid);
        await updateContribution(contribId, { photoUrls: [photoUrl] });
        setCaptureStatus("success");
      }
    } catch {
      setCaptureStatus("error");
    } finally {
      setTimeout(() => setCaptureStatus("idle"), 3000);
    }
  }

  async function startVoice() {
    if (!appUser) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
        setCaptureStatus("uploading");
        try {
          const blob = new Blob(chunksRef.current, {
            type: mimeType || "audio/mp4",
          });
          const loc = getLocation();
          if (!navigator.onLine) {
            await savePending({
              id: crypto.randomUUID(),
              contributorId: appUser.uid,
              contributorName: appUser.displayName,
              eventDate: new Date().toISOString(),
              texts: [],
              location: loc,
              locationName: null,
              photoBlobs: [],
              videoBlobs: [],
              voiceBlobs: [{ blob, mimeType: mimeType || "audio/mp4" }],
              createdAt: new Date().toISOString(),
            });
            setCaptureStatus("offline");
          } else {
            const locationName = loc ? await getLocationName(loc.latitude, loc.longitude) : null;
            const contribId = await createContribution({
              contributorId: appUser.uid,
              contributorName: appUser.displayName,
              eventDate: new Date(),
              texts: [],
              photoUrls: [],
              videoUrls: [],
              voices: [],
              location: loc,
              locationName,
            });
            const voiceUrl = await uploadVoice(blob, contribId, appUser.uid);
            await updateContribution(contribId, { voices: [{ url: voiceUrl, transcript: null }] });
            setCaptureStatus("success");
          }
        } catch {
          setCaptureStatus("error");
        } finally {
          setTimeout(() => setCaptureStatus("idle"), 3000);
        }
      };

      mr.start(250);
      mediaRef.current = mr;
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      // Mic access denied — silently ignore
    }
  }

  function stopVoice() {
    mediaRef.current?.stop();
  }

  const busy = captureStatus === "uploading";

  return (
    <div className="mb-5 rounded-xl border border-rim bg-surface p-4">
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Rýchle zachytenie
        </span>
        <GpsIndicator status={locState.status} onRetry={captureLocation} />
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Camera */}
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy || recording}
          className="flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-gold-text shadow-sm active:scale-95 transition-transform disabled:opacity-50"
        >
          <CameraIcon />
          Odfotiť
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoSelected}
        />

        {/* Voice */}
        {!recording ? (
          <button
            type="button"
            onClick={startVoice}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl border border-rim-strong bg-surface-high px-4 py-2.5 text-sm font-semibold text-ink-dim hover:text-ink active:scale-95 transition-transform disabled:opacity-50"
          >
            <MicIcon />
            Nahrať hlas
          </button>
        ) : (
          <button
            type="button"
            onClick={stopVoice}
            className="flex items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-ink active:scale-95 transition-transform"
          >
            <span className="h-2 w-2 rounded-full bg-ink animate-pulse" />
            {fmtTime(recSeconds)} – Zastaviť
          </button>
        )}
      </div>

      {/* Status feedback */}
      {captureStatus === "uploading" && (
        <p className="mt-2.5 text-xs text-ink-subtle">Nahrávam do Kroniky…</p>
      )}
      {captureStatus === "success" && (
        <p className="mt-2.5 text-xs text-success font-medium">✓ Príspevok uložený</p>
      )}
      {captureStatus === "offline" && (
        <p className="mt-2.5 text-xs text-gold font-medium">☁ Uložené lokálne – odošle sa po obnovení spojenia</p>
      )}
      {captureStatus === "error" && (
        <p className="mt-2.5 text-xs text-danger">Chyba pri ukladaní. Skúste znova.</p>
      )}
    </div>
  );
}

function GpsIndicator({
  status,
  onRetry,
}: {
  status: string;
  onRetry: () => void;
}) {
  if (status === "ok") {
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <PinIcon /> GPS
      </span>
    );
  }
  if (status === "loading") {
    return <span className="text-xs text-ink-subtle">GPS…</span>;
  }
  if (status === "denied") {
    return <span className="text-xs text-ink-subtle">GPS nedostupné</span>;
  }
  return (
    <button onClick={onRetry} className="text-xs text-gold hover:underline">
      Zachytiť GPS
    </button>
  );
}

function CameraIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
