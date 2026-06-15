"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { Button } from "@/components/ui/Button";
import { VoiceRecorder } from "@/components/contributions/VoiceRecorder";
import { PhotoUploader, type PhotoFile } from "@/components/contributions/PhotoUploader";
import { VideoUploader, type VideoFile } from "@/components/contributions/VideoUploader";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { useLocation } from "@/hooks/useLocation";
import { createContribution, updateContribution } from "@/lib/contributionService";
import { uploadPhoto, uploadVideo, uploadVoice } from "@/lib/storageService";
import { getLocationName } from "@/lib/geocoding";
import { savePending } from "@/lib/offlineDb";
import { getCategories } from "@/lib/categoryService";
import { getAllUsers } from "@/lib/userService";
import { UserTagSelector } from "@/components/contributions/UserTagSelector";
import type { Group } from "@/types/contribution";
import type { AppUser } from "@/types/user";

const INPUT_CLS =
  "w-full rounded-xl border border-rim bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold";

function NewContributionForm() {
  const { appUser } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { state: locState, capture: captureLocation } = useLocation();

  const [eventDate, setEventDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [texts, setTexts] = useState<string[]>([""]);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [voiceBlobs, setVoiceBlobs] = useState<{ blob: Blob; previewUrl: string }[]>([]);
  const [recorderKey, setRecorderKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accessibleGroups, setAccessibleGroups] = useState<Group[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [noGroupConfirmed, setNoGroupConfirmed] = useState(false);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [taggedUserError, setTaggedUserError] = useState<{ invalidIds: string[]; invalidNames: string[] } | null>(null);

  useEffect(() => { captureLocation(); }, [captureLocation]);

  useEffect(() => {
    if (!appUser) return;
    Promise.all([getCategories(), getAllUsers()]).then(([cats, users]) => {
      const mine = cats.filter((c) => c.allowedUserIds.includes(appUser.uid));
      setAccessibleGroups(mine);
      setSelectedCategoryIds(new Set(mine.map((c) => c.id)));
      setAllUsers(users);
    });
  }, [appUser]);

  const countFields = useCallback(() => {
    let count = 0;
    if (texts.some((t) => t.trim().length > 0)) count++;
    if (locState.status === "ok") count++;
    if (photos.length > 0) count++;
    if (videos.length > 0) count++;
    if (voiceBlobs.length > 0) count++;
    return count;
  }, [texts, locState.status, photos, videos, voiceBlobs]);

  function updateText(index: number, value: string) {
    setTexts((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  function addText() {
    setTexts((prev) => [...prev, ""]);
  }

  function removeText(index: number) {
    setTexts((prev) => prev.filter((_, i) => i !== index));
  }

  function handleVoiceRecorded(blob: Blob) {
    const previewUrl = URL.createObjectURL(blob);
    setVoiceBlobs((prev) => [...prev, { blob, previewUrl }]);
    setRecorderKey((k) => k + 1);
  }

  function removeVoice(index: number) {
    setVoiceBlobs((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function toggleGroup(groupId: string) {
    setNoGroupConfirmed(false);
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appUser) return;
    if (countFields() < 2) {
      setError(t.newContribution.errorMinFields);
      return;
    }
    if (accessibleGroups.length > 0 && selectedCategoryIds.size === 0 && !noGroupConfirmed) {
      setError(t.newContribution.errorNoGroup);
      return;
    }
    // Validate tagged users are in the contribution's selected groups
    if (taggedUserIds.length > 0) {
      const allowedInSelectedGroups = new Set(
        accessibleGroups
          .filter((g) => selectedCategoryIds.has(g.id))
          .flatMap((g) => g.allowedUserIds)
      );
      const invalidIds = taggedUserIds.filter((uid) => !allowedInSelectedGroups.has(uid));
      if (invalidIds.length > 0) {
        const invalidNames = invalidIds.map(
          (uid) => allUsers.find((u) => u.uid === uid)?.displayName ?? uid
        );
        setTaggedUserError({ invalidIds, invalidNames });
        return;
      }
    }
    setSaving(true);
    setError(null);
    setTaggedUserError(null);
    try {
      const filteredTexts = texts.filter((t) => t.trim().length > 0);
      const loc = locState.status === "ok" ? locState.data : null;

      if (!navigator.onLine) {
        await savePending({
          id: crypto.randomUUID(),
          contributorId: appUser.uid,
          contributorName: appUser.displayName,
          eventDate: new Date(eventDate).toISOString(),
          texts: filteredTexts,
          location: loc,
          locationName: null,
          photoBlobs: photos.map((p) => p.file),
          videoBlobs: videos.map((v) => v.file),
          voiceBlobs: voiceBlobs.map(({ blob }) => ({ blob, mimeType: blob.type })),
          createdAt: new Date().toISOString(),
        });
        photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
        videos.forEach((v) => URL.revokeObjectURL(v.previewUrl));
        voiceBlobs.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
        sessionStorage.setItem("pwa-offline-saved", "1");
        router.push("/dashboard");
        return;
      }

      const locationName = loc ? await getLocationName(loc.latitude, loc.longitude) : null;
      const selectedGroupIds = Array.from(selectedCategoryIds);
      const selectedGroupObjects = accessibleGroups.filter((g) => selectedGroupIds.includes(g.id));
      const visibleToIds = [
        appUser.uid,
        ...selectedGroupObjects.flatMap((g) => g.allowedUserIds),
      ].filter((v, i, a) => a.indexOf(v) === i);

      const contribId = await createContribution({
        contributorId: appUser.uid,
        contributorName: appUser.displayName,
        eventDate: new Date(eventDate),
        texts: filteredTexts,
        photoUrls: [],
        videoUrls: [],
        voices: [],
        location: loc,
        locationName,
        categories: selectedGroupIds,
        visibleToIds,
        taggedUserIds,
      });

      const photoUrls: string[] = [];
      for (const p of photos) {
        photoUrls.push(await uploadPhoto(p.file, contribId, appUser.uid));
        URL.revokeObjectURL(p.previewUrl);
      }

      const videoUrls: string[] = [];
      for (const v of videos) {
        videoUrls.push(await uploadVideo(v.file, contribId, appUser.uid));
        URL.revokeObjectURL(v.previewUrl);
      }

      const uploadedVoices: { url: string; transcript: null }[] = [];
      for (const { blob } of voiceBlobs) {
        const url = await uploadVoice(blob, contribId, appUser.uid);
        uploadedVoices.push({ url, transcript: null });
      }

      if (photoUrls.length > 0 || videoUrls.length > 0 || uploadedVoices.length > 0) {
        await updateContribution(contribId, { photoUrls, videoUrls, voices: uploadedVoices });
      }
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError(t.newContribution.errorSave);
      setSaving(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-xl px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-ink-subtle hover:text-ink-dim">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <h1 className="text-lg font-semibold text-ink">{t.newContribution.title}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink-dim mb-1.5">{t.newContribution.eventDate}</label>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
              className={INPUT_CLS} required />
          </div>

          {/* Multiple texts */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-ink-dim">{t.newContribution.textNotes}</label>
            {texts.map((txt, i) => (
              <div key={i} className="flex gap-2">
                <textarea
                  value={txt}
                  onChange={(e) => updateText(i, e.target.value)}
                  placeholder={t.newContribution.textPlaceholder}
                  rows={3}
                  className={`${INPUT_CLS} resize-none flex-1`}
                />
                {texts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeText(i)}
                    className="shrink-0 self-start mt-1 rounded-lg p-1.5 text-ink-subtle hover:text-danger hover:bg-danger-dim"
                    title={t.newContribution.removeNote}
                  >
                    <TrashSmallIcon />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addText}
              className="flex items-center gap-1.5 text-sm text-gold hover:text-gold/80"
            >
              <PlusSmallIcon /> {t.newContribution.addNote}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-dim mb-2">{t.newContribution.photos}</label>
            <PhotoUploader photos={photos} onChange={setPhotos} />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-dim mb-2">{t.newContribution.videos}</label>
            <VideoUploader videos={videos} onChange={setVideos} />
          </div>

          {/* Multiple voices */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-ink-dim">{t.newContribution.voiceMessages}</label>
            {voiceBlobs.map(({ previewUrl }, i) => (
              <div key={previewUrl} className="flex items-center gap-2 rounded-xl bg-surface border border-rim px-3 py-2">
                <audio src={previewUrl} controls className="h-8 flex-1 min-w-0" />
                <button
                  type="button"
                  onClick={() => removeVoice(i)}
                  className="shrink-0 text-ink-subtle hover:text-danger"
                  aria-label={t.newContribution.removeVoice}
                >
                  <TrashSmallIcon />
                </button>
              </div>
            ))}
            <VoiceRecorder
              key={recorderKey}
              maxSeconds={180}
              onRecorded={handleVoiceRecorded}
            />
          </div>

          {accessibleGroups.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-ink-dim">{t.newContribution.groups}</label>
              <div className="flex flex-wrap gap-2">
                {accessibleGroups.map((g) => {
                  const selected = selectedCategoryIds.has(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGroup(g.id)}
                      className={`rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
                        selected
                          ? "border-transparent text-gold-text"
                          : "border-rim text-ink-dim hover:border-rim-strong"
                      }`}
                      style={selected ? { backgroundColor: g.color, borderColor: g.color } : {}}
                    >
                      {g.icon ? g.icon + " " + g.name : g.name}
                    </button>
                  );
                })}
              </div>

              {selectedCategoryIds.size === 0 && (
                <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 space-y-2">
                  <p className="text-xs font-medium text-warning">
                    {t.newContribution.noGroupWarning}
                  </p>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noGroupConfirmed}
                      onChange={(e) => setNoGroupConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
                    />
                    <span className="text-xs text-ink-dim">
                      {t.newContribution.noGroupAcknowledge}
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {appUser && accessibleGroups.length > 0 && (
            <UserTagSelector
              groups={accessibleGroups}
              selectedGroupIds={Array.from(selectedCategoryIds)}
              allUsers={allUsers}
              currentUserId={appUser.uid}
              taggedUserIds={taggedUserIds}
              onChange={(ids) => { setTaggedUserIds(ids); setTaggedUserError(null); }}
              label={t.taggedUsers.label}
              noUsersLabel={t.taggedUsers.noUsers}
            />
          )}

          {taggedUserError && (
            <div className="rounded-xl border border-danger/40 bg-danger-dim p-3 space-y-2">
              <p className="text-xs font-medium text-danger">{t.taggedUsers.validationError}</p>
              <p className="text-xs text-danger/80">{taggedUserError.invalidNames.join(", ")}</p>
              <button
                type="button"
                onClick={() => {
                  setTaggedUserIds((prev) =>
                    prev.filter((uid) => !taggedUserError.invalidIds.includes(uid))
                  );
                  setTaggedUserError(null);
                }}
                className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
              >
                {t.taggedUsers.fixBtn}
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            {locState.status === "ok" && (
              <span className="flex items-center gap-1.5 text-success"><PinIcon /> {t.newContribution.locationOk}</span>
            )}
            {locState.status === "loading" && <span className="text-ink-subtle">{t.newContribution.locationLoading}</span>}
            {locState.status === "denied" && (
              <span className="flex flex-col gap-0.5">
                <span className="text-ink-subtle">{t.newContribution.locationDenied}</span>
                <span className="text-[11px] text-ink-subtle/70">{t.newContribution.locationDeniedHint}</span>
              </span>
            )}
            {locState.status === "idle" && (
              <button type="button" onClick={captureLocation} className="text-gold hover:underline">
                {t.newContribution.locationCapture}
              </button>
            )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" loading={saving} size="lg" className="w-full">
            {t.newContribution.save}
          </Button>
        </form>
      </main>
    </>
  );
}

export default function NewContributionPage() {
  return (
    <RouteGuard requiredRole="contributor">
      <NewContributionForm />
    </RouteGuard>
  );
}

function PinIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function TrashSmallIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  );
}
function PlusSmallIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
