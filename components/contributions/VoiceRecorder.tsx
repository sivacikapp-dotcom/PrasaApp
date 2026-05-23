"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

interface VoiceRecorderProps {
  existingUrl?: string | null;
  maxSeconds: number;
  onRecorded: (blob: Blob) => void;
  onDelete?: () => void;
}

type RecState = "idle" | "recording" | "done";

function fmt(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function VoiceRecorder({ existingUrl, maxSeconds, onRecorded, onDelete }: VoiceRecorderProps) {
  const [state, setState] = useState<RecState>(existingUrl ? "done" : "idle");
  const [seconds, setSeconds] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(existingUrl ?? null);
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (blobUrl && !existingUrl) URL.revokeObjectURL(blobUrl);
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = (() => {
        const candidates = [
          "audio/mp4;codecs=mp4a.40.2",
          "audio/mp4",
          "audio/webm;codecs=opus",
          "audio/webm",
        ];
        return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      })();
      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/mp4" });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setState("done");
        onRecorded(blob);
        if (timerRef.current) clearInterval(timerRef.current);
      };
      mr.start(250);
      mediaRef.current = mr;
      setState("recording");
      secondsRef.current = 0;
      setSeconds(0);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= maxSeconds) {
          mediaRef.current?.stop();
        }
      }, 1000);
    } catch {
      setError("Nepodarilo sa získať prístup k mikrofónu.");
    }
  }

  function stopRecording() { mediaRef.current?.stop(); }

  function deleteRecording() {
    if (blobUrl && !existingUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setState("idle");
    secondsRef.current = 0;
    setSeconds(0);
    onDelete?.();
  }

  const remaining = maxSeconds - seconds;
  const timeColorCls =
    remaining <= 10 ? "text-danger" :
    remaining <= 30 ? "text-amber-500" :
    "text-ink-dim";

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-danger">{error}</p>}

      {state === "idle" && (
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={startRecording}>
            <MicIcon /> Nahrať hlasovú správu
          </Button>
          <span className="text-xs text-ink-subtle">max {fmt(maxSeconds)}</span>
        </div>
      )}

      {state === "recording" && (
        <div className="flex items-center gap-3">
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-danger animate-pulse" />
          <span className={`text-sm font-mono tabular-nums ${timeColorCls}`}>{fmt(remaining)}</span>
          <Button type="button" variant="danger" size="sm" onClick={stopRecording}>Zastaviť</Button>
        </div>
      )}

      {state === "done" && blobUrl && (
        <div className="flex items-center gap-3 rounded-xl bg-surface border border-rim px-3 py-2">
          <audio src={blobUrl} controls className="h-8 flex-1 min-w-0" />
          <button type="button" onClick={deleteRecording}
            className="shrink-0 text-ink-subtle hover:text-danger" aria-label="Odstrániť nahrávku">
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
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

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  );
}
