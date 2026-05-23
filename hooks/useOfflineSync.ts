"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAllPending,
  deletePending,
  countPending,
  type PendingContribution,
} from "@/lib/offlineDb";
import { createContribution, updateContribution } from "@/lib/contributionService";
import { uploadPhoto, uploadVideo, uploadVoice } from "@/lib/storageService";

export function useOfflineSync() {
  const { appUser } = useAuth();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      setPendingCount(await countPending());
    } catch {
      // IndexedDB not available (SSR, private browsing)
    }
  }, []);

  const syncOne = useCallback(
    async (item: PendingContribution): Promise<boolean> => {
      if (!appUser) return false;
      try {
        const contribId = await createContribution({
          contributorId: item.contributorId,
          contributorName: item.contributorName,
          eventDate: new Date(item.eventDate),
          texts: item.texts,
          photoUrls: [],
          videoUrls: [],
          voices: [],
          location: item.location,
          locationName: item.locationName,
        });

        const photoUrls: string[] = [];
        for (const blob of item.photoBlobs) {
          const ext = blob.type.split("/")[1] ?? "jpg";
          const file = new File([blob], `photo.${ext}`, { type: blob.type });
          photoUrls.push(await uploadPhoto(file, contribId, item.contributorId));
        }

        const videoUrls: string[] = [];
        for (const blob of (item.videoBlobs ?? [])) {
          const ext = blob.type.split("/")[1]?.split(";")[0] ?? "mp4";
          const file = new File([blob], `video.${ext}`, { type: blob.type });
          videoUrls.push(await uploadVideo(file, contribId, item.contributorId));
        }

        const voices: { url: string; transcript: null }[] = [];
        for (const { blob } of item.voiceBlobs) {
          const url = await uploadVoice(blob, contribId, item.contributorId);
          voices.push({ url, transcript: null });
        }

        if (photoUrls.length > 0 || videoUrls.length > 0 || voices.length > 0) {
          await updateContribution(contribId, { photoUrls, videoUrls, voices });
        }

        await deletePending(item.id);
        return true;
      } catch {
        // Leave in queue for next retry
        return false;
      }
    },
    [appUser]
  );

  const syncAll = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine || !appUser) return;
    syncingRef.current = true;
    try {
      const items = await getAllPending();
      for (const item of items) {
        if (!navigator.onLine) break;
        await syncOne(item);
      }
    } catch {
      // Network error — will retry on next online event
    } finally {
      syncingRef.current = false;
      await refreshCount();
    }
  }, [appUser, syncOne, refreshCount]);

  // Sync pending items on mount when online
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine && appUser) {
      syncAll();
    }
  }, [appUser, syncAll]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncAll();
    };
    const handleOffline = () => setIsOnline(false);
    const handleChanged = () => refreshCount();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("prasa:pending-changed", handleChanged);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("prasa:pending-changed", handleChanged);
    };
  }, [syncAll, refreshCount]);

  return { isOnline, pendingCount };
}
