"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { useLocation } from "@/hooks/useLocation";
import { createContribution, updateContribution } from "@/lib/contributionService";
import { uploadPhoto, uploadVoice, uploadVideo } from "@/lib/storageService";
import { getLocationName } from "@/lib/geocoding";
import { savePending } from "@/lib/offlineDb";
import { getCategories } from "@/lib/categoryService";
import type { Group } from "@/types/contribution";

type CaptureStatus = "idle" | "uploading" | "success" | "offline" | "error";

function pickAudioMimeType(): string {
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
  const { t } = useI18n();
  const { state: locState, capture: captureLocation } = useLocation();

  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>("idle");
  const [accessibleGroups, setAccessibleGroups] = useState<Group[]>([]);

  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);

  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const voiceMediaRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    captureLocation();
  }, [captureLocation]);

  useEffect(() => {
    if (!appUser) return;
    getCategories().then((cats) => {
      setAccessibleGroups(cats.filter((c) => c.allowedUserIds.includes(appUser.uid)));
    });
  }, [appUser]);

  const getLocation = useCallback(() => {
    return locState.status === "ok" ? locState.data : null;
  }, [locState]);

  function getGroupParams() {
    const categories = accessibleGroups.map((g) => g.id);
    const visibleToIds = appUser
      ? [appUser.uid, ...accessibleGroups.flatMap((g) => g.allowedUserIds)].filter(
          (v, i, a) => a.indexOf(v) === i
        )
      : [];
    return { categories, visibleToIds };
  }

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
          ...getGroupParams(),
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
    setVoiceReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickAudioMimeType();
      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      voiceChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
        setVoiceRecording(false);
        setCaptureStatus("uploading");
        try {
          const blob = new Blob(voiceChunksRef.current, { type: mimeType || "audio/mp4" });
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
              ...getGroupParams(),
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
      voiceMediaRef.current = mr;
      setVoiceRecording(true);
      setVoiceSeconds(0);
      voiceTimerRef.current = setInterval(() => setVoiceSeconds((s) => s + 1), 1000);
    } catch {
      setVoiceReady(false);
    }
  }

  function stopVoice() {
    voiceMediaRef.current?.stop();
  }

  async function handleVideoSelected(e: React.ChangeEvent<HTMLInputElement>) {
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
          photoBlobs: [],
          videoBlobs: [file],
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
          ...getGroupParams(),
        });
        const videoUrl = await uploadVideo(file, contribId, appUser.uid);
        await updateContribution(contribId, { videoUrls: [videoUrl] });
        setCaptureStatus("success");
      }
    } catch {
      setCaptureStatus("error");
    } finally {
      setTimeout(() => setCaptureStatus("idle"), 3000);
    }
  }

  const busy = captureStatus === "uploading";
  const anyRecording = voiceRecording;

  return (
    <div className="mb-5 rounded-xl border border-rim bg-surface p-4">
      {/* Header */}
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span />
        <span className="text-center text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t.quickCapture.title}
        </span>
        <div className="flex justify-end">
          <GpsIndicator status={locState.status} onRetry={captureLocation} />
        </div>
      </div>

      {/* Buttons row */}
      <div className="flex flex-wrap gap-2">

        {/* Camera */}
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy || anyRecording || voiceReady}
          className="flex items-center gap-2 rounded-xl border border-rim-strong bg-surface-high px-4 py-2.5 text-sm font-semibold text-ink-dim hover:text-ink active:scale-95 transition-transform disabled:opacity-50"
        >
          <CameraIcon />
          {t.quickCapture.photo}
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
        {!voiceReady && !voiceRecording && (
          <button
            type="button"
            onClick={() => setVoiceReady(true)}
            disabled={busy || anyRecording}
            className="flex items-center gap-2 rounded-xl border border-rim-strong bg-surface-high px-4 py-2.5 text-sm font-semibold text-ink-dim hover:text-ink active:scale-95 transition-transform disabled:opacity-50"
          >
            <MicIcon />
            {t.quickCapture.voiceReady}
          </button>
        )}
        {voiceReady && !voiceRecording && (
          <>
            <button
              type="button"
              onClick={startVoice}
              className="flex items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-ink active:scale-95 transition-transform"
            >
              <span className="h-2 w-2 rounded-full bg-ink" />
              {t.quickCapture.voiceStart}
            </button>
            <button
              type="button"
              onClick={() => setVoiceReady(false)}
              className="flex items-center gap-2 rounded-xl border border-rim px-4 py-2.5 text-sm font-semibold text-ink-dim hover:text-ink active:scale-95 transition-transform"
            >
              {t.quickCapture.voiceCancel}
            </button>
          </>
        )}
        {voiceRecording && (
          <button
            type="button"
            onClick={stopVoice}
            className="flex items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-ink active:scale-95 transition-transform"
          >
            <span className="h-2 w-2 rounded-full bg-ink animate-pulse" />
            {t.quickCapture.voiceStop(fmtTime(voiceSeconds))}
          </button>
        )}

        {/* Video */}
        <button
          type="button"
          onClick={() => videoRef.current?.click()}
          disabled={busy || anyRecording || voiceReady}
          className="flex items-center gap-2 rounded-xl border border-rim-strong bg-surface-high px-4 py-2.5 text-sm font-semibold text-ink-dim hover:text-ink active:scale-95 transition-transform disabled:opacity-50"
        >
          <VideoIcon />
          {t.quickCapture.video}
        </button>
        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={handleVideoSelected}
        />
      </div>

      {/* Status feedback */}
      {captureStatus === "uploading" && (
        <p className="mt-2.5 text-xs text-ink-subtle">{t.quickCapture.statusUploading}</p>
      )}
      {captureStatus === "success" && (
        <p className="mt-2.5 text-xs text-success font-medium">{t.quickCapture.statusSuccess}</p>
      )}
      {captureStatus === "offline" && (
        <p className="mt-2.5 text-xs text-gold font-medium">{t.quickCapture.statusOffline}</p>
      )}
      {captureStatus === "error" && (
        <p className="mt-2.5 text-xs text-danger">{t.quickCapture.statusError}</p>
      )}
    </div>
  );
}

function GpsIndicator({ status, onRetry }: { status: string; onRetry: () => void }) {
  const { t } = useI18n();
  if (status === "ok") return <span className="flex items-center gap-1 text-xs text-success"><PinIcon /> GPS</span>;
  if (status === "loading") return <span className="text-xs text-ink-subtle">GPS…</span>;
  if (status === "denied") return <span className="text-xs text-ink-subtle">{t.quickCapture.gpsUnavailable}</span>;
  return <button onClick={onRetry} className="text-xs text-gold hover:underline">{t.quickCapture.gpsCaptureBtn}</button>;
}

function CameraIcon() {
  return (
    <svg className="h-4 w-4 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="h-4 w-4 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg className="h-4 w-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
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
