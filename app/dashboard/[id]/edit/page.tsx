"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { Button } from "@/components/ui/Button";
import { VoiceRecorder } from "@/components/contributions/VoiceRecorder";
import { PhotoUploader, type PhotoFile } from "@/components/contributions/PhotoUploader";
import { PageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { getContribution, updateContribution } from "@/lib/contributionService";
import { uploadPhoto, uploadVoice, deleteFile } from "@/lib/storageService";
import type { Contribution, VoiceNote } from "@/types/contribution";

const INPUT_CLS =
  "w-full rounded-xl border border-rim bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold";

function EditContributionForm() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { appUser } = useAuth();

  const [contribution, setContribution] = useState<Contribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);

  const [eventDate, setEventDate] = useState("");
  const [texts, setTexts] = useState<string[]>([""]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<PhotoFile[]>([]);
  // Existing voices from Firestore
  const [existingVoices, setExistingVoices] = useState<VoiceNote[]>([]);
  const [deletedVoiceUrls, setDeletedVoiceUrls] = useState<string[]>([]);
  // Newly recorded voices (not yet uploaded)
  const [newVoiceBlobs, setNewVoiceBlobs] = useState<{ blob: Blob; previewUrl: string }[]>([]);
  const [recorderKey, setRecorderKey] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getContribution(id).then((c) => {
      if (!c) { setLoading(false); return; }
      if (c.status !== "pending" || c.contributorId !== appUser?.uid) {
        setNotAllowed(true);
        setLoading(false);
        return;
      }
      setContribution(c);
      setEventDate(format(c.eventDate, "yyyy-MM-dd"));
      setTexts(c.texts.length > 0 ? c.texts : [""]);
      setExistingPhotos(c.photoUrls);
      setExistingVoices(c.voices);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function updateText(index: number, value: string) {
    setTexts((prev) => prev.map((t, i) => (i === index ? value : t)));
  }
  function addText() { setTexts((prev) => [...prev, ""]); }
  function removeText(index: number) { setTexts((prev) => prev.filter((_, i) => i !== index)); }

  function removeExistingVoice(url: string) {
    setDeletedVoiceUrls((prev) => [...prev, url]);
    setExistingVoices((prev) => prev.filter((v) => v.url !== url));
  }

  function handleVoiceRecorded(blob: Blob) {
    const previewUrl = URL.createObjectURL(blob);
    setNewVoiceBlobs((prev) => [...prev, { blob, previewUrl }]);
    setRecorderKey((k) => k + 1);
  }

  function removeNewVoice(index: number) {
    setNewVoiceBlobs((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appUser || !contribution) return;
    const filteredTexts = texts.filter((t) => t.trim().length > 0);
    const hasPhotos = existingPhotos.length > 0 || newPhotos.length > 0;
    const hasVoices = existingVoices.length > 0 || newVoiceBlobs.length > 0;
    let fieldCount = 0;
    if (filteredTexts.length > 0) fieldCount++;
    if (contribution.location) fieldCount++;
    if (hasPhotos) fieldCount++;
    if (hasVoices) fieldCount++;
    if (fieldCount < 2) {
      setError("Príspevok musí obsahovať aspoň 2 z týchto údajov: text, GPS poloha, fotografia, hlasová správa. Doplňte aspoň jeden ďalší údaj.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Delete removed voice files from storage
      await Promise.all(deletedVoiceUrls.map((url) => deleteFile(url)));

      const uploadedPhotos = await Promise.all(
        newPhotos.map((p) => uploadPhoto(p.file, id, appUser.uid))
      );
      newPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));

      const uploadedVoices: VoiceNote[] = [];
      for (const { blob } of newVoiceBlobs) {
        const url = await uploadVoice(blob, id, appUser.uid);
        uploadedVoices.push({ url, transcript: null });
      }

      await updateContribution(id, {
        eventDate: new Date(eventDate),
        texts: filteredTexts,
        photoUrls: [...existingPhotos, ...uploadedPhotos],
        voices: [...existingVoices, ...uploadedVoices],
      });

      router.push(`/dashboard/${id}`);
    } catch (err) {
      console.error(err);
      setError("Nepodarilo sa uložiť zmeny. Skúste znova.");
      setSaving(false);
    }
  }

  if (loading) return <><NavBar /><PageSpinner /></>;

  if (notAllowed || !contribution) {
    return (
      <>
        <NavBar />
        <div className="p-8 text-center text-ink-dim">
          {notAllowed ? "Príspevok nie je možné upraviť." : "Príspevok neexistuje."}
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-xl px-4 py-6 pb-10">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-ink-subtle hover:text-ink-dim">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-ink">Upraviť príspevok</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink-dim mb-1.5">Dátum udalosti</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className={INPUT_CLS}
              required
            />
          </div>

          {/* Multiple texts */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-ink-dim">Textové poznámky</label>
            {texts.map((t, i) => (
              <div key={i} className="flex gap-2">
                <textarea
                  value={t}
                  onChange={(e) => updateText(i, e.target.value)}
                  placeholder="Čo sa udialo?"
                  rows={3}
                  className={`${INPUT_CLS} resize-none flex-1`}
                />
                {texts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeText(i)}
                    className="shrink-0 self-start mt-1 rounded-lg p-1.5 text-ink-subtle hover:text-danger hover:bg-danger-dim"
                    title="Odstrániť poznámku"
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
              <PlusSmallIcon /> Pridať ďalšiu poznámku
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-dim mb-2">Fotografie</label>
            <PhotoUploader
              photos={newPhotos}
              existingUrls={existingPhotos}
              onChange={setNewPhotos}
              onDeleteExisting={(url) => setExistingPhotos((prev) => prev.filter((u) => u !== url))}
            />
          </div>

          {/* Multiple voices */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-ink-dim">Hlasové správy</label>
            {existingVoices.map((v) => (
              <div key={v.url} className="flex items-center gap-2 rounded-xl bg-surface border border-rim px-3 py-2">
                <audio src={v.url} controls className="h-8 flex-1 min-w-0" />
                <button
                  type="button"
                  onClick={() => removeExistingVoice(v.url)}
                  className="shrink-0 text-ink-subtle hover:text-danger"
                  aria-label="Odstrániť nahrávku"
                >
                  <TrashSmallIcon />
                </button>
              </div>
            ))}
            {newVoiceBlobs.map(({ previewUrl }, i) => (
              <div key={previewUrl} className="flex items-center gap-2 rounded-xl bg-surface border border-gold/30 px-3 py-2">
                <audio src={previewUrl} controls className="h-8 flex-1 min-w-0" />
                <button
                  type="button"
                  onClick={() => removeNewVoice(i)}
                  className="shrink-0 text-ink-subtle hover:text-danger"
                  aria-label="Odstrániť nahrávku"
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

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" loading={saving} size="lg" className="w-full">
            Uložiť zmeny
          </Button>
        </form>
      </main>
    </>
  );
}

export default function EditContributionPage() {
  return (
    <RouteGuard requiredRole="contributor">
      <EditContributionForm />
    </RouteGuard>
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
