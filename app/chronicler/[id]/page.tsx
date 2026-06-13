"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageSpinner } from "@/components/ui/Spinner";
import { VoiceRecorder } from "@/components/contributions/VoiceRecorder";
import { PhotoUploader, type PhotoFile } from "@/components/contributions/PhotoUploader";
import { getContribution, updateContributionByChronicler } from "@/lib/contributionService";
import { getCategories, getTags } from "@/lib/categoryService";
import { uploadChroniclerPhoto, uploadChroniclerVoice } from "@/lib/storageService";
import { addContributionsToGroup, getEventGroups } from "@/lib/eventGroupService";
import { addContributionsToEvent, createEvent, getEvents, removeContributionFromEvent, updateEvent } from "@/lib/eventService";
import { GroupPickerModal } from "@/components/ui/GroupPickerModal";
import { EventPickerModal } from "@/components/ui/EventPickerModal";
import { EventGroupConflictModal } from "@/components/ui/EventGroupConflictModal";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import type { Contribution, Group, Tag, ChronicleEvent, EventGroup } from "@/types/contribution";

const INPUT_CLS =
  "w-full rounded-xl border border-rim bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold";

function ChroniclerDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { appUser } = useAuth();
  const { t, dateFnsLocale } = useI18n();

  const [contribution, setContribution] = useState<Contribution | null>(null);
  const [categories, setCategories] = useState<Group[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const [verifiedDate, setVerifiedDate] = useState("");
  const [chroniclerText, setChroniclerText] = useState("");
  const [voiceTranscripts, setVoiceTranscripts] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<PhotoFile[]>([]);
  const [existingChroniclerPhotos, setExistingChroniclerPhotos] = useState<string[]>([]);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [chroniclerVoiceTranscript, setChroniclerVoiceTranscript] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [transcribingVoiceIndex, setTranscribingVoiceIndex] = useState<number | null>(null);
  const [transcribingChroniclerVoice, setTranscribingChroniclerVoice] = useState(false);
  const [transcribeVoiceError, setTranscribeVoiceError] = useState<{ index: number; msg: string } | null>(null);
  const [transcribeChroniclerError, setTranscribeChroniclerError] = useState<string | null>(null);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [assignedFeedback, setAssignedFeedback] = useState<string | null>(null);
  const [pendingEventConflict, setPendingEventConflict] = useState<ChronicleEvent | null>(null);
  const [allGroups, setAllGroups] = useState<EventGroup[]>([]);
  const [allEvents, setAllEvents] = useState<ChronicleEvent[]>([]);

  useEffect(() => {
    Promise.all([getContribution(id), getCategories(), getTags(), getEventGroups(), getEvents()]).then(([c, cats, ts, grps, evs]) => {
      setAllGroups(grps);
      setAllEvents(evs);
      if (c) {
        setContribution(c);
        setVerifiedDate(c.verifiedEventDate ? format(c.verifiedEventDate, "yyyy-MM-dd") : "");
        setChroniclerText(c.chroniclerText ?? "");
        setVoiceTranscripts(c.voices.map((v) => v.transcript ?? ""));
        setChroniclerVoiceTranscript(c.chroniclerVoiceTranscript ?? "");
        setExistingChroniclerPhotos(c.chroniclerPhotoUrls);
        setSelectedCategories(c.categories);
        setSelectedTags(c.hashtags);
      }
      setCategories(cats);
      setTags(ts);
      setLoading(false);
    });
  }, [id]);

  function toggleTag(tagId: string) {
    setSelectedTags((prev) => prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]);
  }

  async function handleSave(markProcessed: boolean) {
    if (!contribution) return;
    setSaving(true);
    const uploadedPhotos = await Promise.all(newPhotos.map((p) => uploadChroniclerPhoto(p.file, id)));
    const allChroniclerPhotos = [...existingChroniclerPhotos, ...uploadedPhotos];
    let chroniclerVoiceUrl = contribution.chroniclerVoiceUrl;
    if (voiceBlob) chroniclerVoiceUrl = await uploadChroniclerVoice(voiceBlob, id);

    const visibleToIds = [
      contribution.contributorId,
      ...selectedCategories.flatMap(
        (catId) => categories.find((c) => c.id === catId)?.allowedUserIds ?? []
      ),
    ].filter((v, i, a) => a.indexOf(v) === i);

    const updatedVoices = contribution.voices.map((v, i) => ({
      ...v,
      transcript: voiceTranscripts[i]?.trim() || null,
    }));

    await updateContributionByChronicler(id, {
      verifiedEventDate: verifiedDate ? new Date(verifiedDate) : null,
      chroniclerText: chroniclerText.trim() || null,
      chroniclerVoiceUrl,
      chroniclerPhotoUrls: allChroniclerPhotos,
      voices: updatedVoices,
      chroniclerVoiceTranscript: chroniclerVoiceTranscript.trim() || null,
      categories: selectedCategories,
      hashtags: selectedTags,
      visibleToIds,
      ...(markProcessed ? { status: "processed" } : {}),
    });

    setNewPhotos([]);
    setExistingChroniclerPhotos(allChroniclerPhotos);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (markProcessed) router.push("/chronicler");
  }

  async function handleTranscribeVoice(index: number) {
    const v = contribution?.voices[index];
    if (!v?.url) return;
    setTranscribingVoiceIndex(index);
    setTranscribeVoiceError(null);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceUrl: v.url }),
      });
      const data = await res.json() as { transcript?: string; error?: string };
      if (data.transcript) {
        setVoiceTranscripts((prev) => {
          const next = [...prev];
          next[index] = data.transcript!;
          return next;
        });
        const updatedVoices = (contribution?.voices ?? []).map((voice, i) =>
          i === index ? { ...voice, transcript: data.transcript! } : voice
        );
        await updateContributionByChronicler(id, { voices: updatedVoices });
      } else {
        setTranscribeVoiceError({ index, msg: data.error ?? t.chroniclerDetail.unknownError });
      }
    } catch (err) {
      setTranscribeVoiceError({ index, msg: err instanceof Error ? err.message : t.chroniclerDetail.unknownError });
    } finally {
      setTranscribingVoiceIndex(null);
    }
  }

  async function handleTranscribeChroniclerVoice() {
    const url = contribution?.chroniclerVoiceUrl;
    if (!url) return;
    setTranscribingChroniclerVoice(true);
    setTranscribeChroniclerError(null);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceUrl: url }),
      });
      const data = await res.json() as { transcript?: string; error?: string };
      if (data.transcript) {
        setChroniclerVoiceTranscript(data.transcript);
        await updateContributionByChronicler(id, { chroniclerVoiceTranscript: data.transcript });
      } else {
        setTranscribeChroniclerError(data.error ?? t.chroniclerDetail.unknownError);
      }
    } catch (err) {
      setTranscribeChroniclerError(err instanceof Error ? err.message : t.chroniclerDetail.unknownError);
    } finally {
      setTranscribingChroniclerVoice(false);
    }
  }

  async function handleAssignToGroup(group: EventGroup) {
    await addContributionsToGroup(group.id, [id]);
    setContribution((prev) =>
      prev && !prev.eventGroupIds.includes(group.id)
        ? { ...prev, eventGroupIds: [...prev.eventGroupIds, group.id] }
        : prev
    );
    setAssignedFeedback(t.chroniclerDetail.assignedToGroup(group.title));
    setTimeout(() => setAssignedFeedback(null), 3000);
  }

  async function doAddToEvent(event: ChronicleEvent) {
    await addContributionsToEvent(event.id, [id]);
    setAllEvents((prev) =>
      prev.map((ev) =>
        ev.id === event.id && !ev.contributionIds.includes(id)
          ? { ...ev, contributionIds: [...ev.contributionIds, id] }
          : ev
      )
    );
    setAssignedFeedback(t.chroniclerDetail.assignedToEvent(event.title));
    setTimeout(() => setAssignedFeedback(null), 3000);
  }

  async function handleAssignToEvent(event: ChronicleEvent) {
    if (!contribution) return;
    const eventCatId = event.categoryId;
    const hasConflict = eventCatId !== null && !contribution.categories.includes(eventCatId);
    if (hasConflict) {
      setPendingEventConflict(event);
      return;
    }
    await doAddToEvent(event);
  }

  async function handleConflictOverwriteContrib() {
    if (!pendingEventConflict || !contribution) return;
    const eventCatId = pendingEventConflict.categoryId!;
    const newCat = categories.find((c) => c.id === eventCatId);
    const newVisibleToIds = [
      contribution.contributorId,
      ...(newCat?.allowedUserIds ?? []),
    ].filter((v, i, a) => a.indexOf(v) === i);
    await updateContributionByChronicler(id, { categories: [eventCatId], visibleToIds: newVisibleToIds });
    setContribution((prev) => prev ? { ...prev, categories: [eventCatId] } : prev);
    setSelectedCategories([eventCatId]);
    await doAddToEvent(pendingEventConflict);
    setPendingEventConflict(null);
  }

  async function handleConflictChangeEvent() {
    if (!pendingEventConflict || !contribution) return;
    const newCatId = contribution.categories[0];
    await updateEvent(pendingEventConflict.id, { categoryId: newCatId });
    setAllEvents((prev) =>
      prev.map((ev) =>
        ev.id === pendingEventConflict.id ? { ...ev, categoryId: newCatId } : ev
      )
    );
    await doAddToEvent(pendingEventConflict);
    setPendingEventConflict(null);
  }

  async function handleRemoveFromEvent(eventId: string) {
    await removeContributionFromEvent(eventId, id);
    setAllEvents((prev) =>
      prev.map((ev) =>
        ev.id === eventId
          ? { ...ev, contributionIds: ev.contributionIds.filter((cid) => cid !== id) }
          : ev
      )
    );
  }

  async function handleCreateAndAssignEvent(title: string, categoryId: string | null) {
    if (!appUser) return;
    const eventId = await createEvent({ title, contributionIds: [id], categoryId, createdBy: appUser.uid });
    setAllEvents((prev) => [
      ...prev,
      {
        id: eventId,
        title,
        categoryId,
        contributionIds: [id],
        locationName: null,
        dateFrom: null,
        dateTo: null,
        description: null,
        entityOrder: [],
        hiddenItems: [],
        categories: [],
        hashtags: [],
        editorIds: [],
        createdBy: appUser.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ChronicleEvent,
    ]);
    setAssignedFeedback(t.chroniclerDetail.eventCreatedFeedback(title));
    setTimeout(() => setAssignedFeedback(null), 4000);
  }

  if (loading) return <><NavBar /><PageSpinner /></>;
  if (!contribution) return <><NavBar /><div className="p-6 text-ink-dim">{t.chroniclerDetail.notFound}</div></>;

  const c = contribution;

  const linkedGroups = allGroups.filter((g) => c.eventGroupIds.includes(g.id));
  const linkedEvents = allEvents.filter((ev) => ev.contributionIds.includes(id));

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-6 pb-28 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-ink-subtle hover:text-ink-dim">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div className="flex-1">
            <p className="text-xs text-ink-subtle">
              {c.contributorName} · {format(c.recordedAt, "d.M.yyyy HH:mm", { locale: dateFnsLocale })}
            </p>
            <p className="text-xs font-medium text-gold">
              {t.chroniclerDetail.eventLabel} {format(c.eventDate, "d. MMMM yyyy", { locale: dateFnsLocale })}
            </p>
          </div>
          <Badge color={c.status === "processed" ? "green" : "amber"}>
            {c.status === "processed" ? t.components.statusProcessed : t.components.statusPending}
          </Badge>
        </div>

        {/* Original contribution */}
        <section className="rounded-xl bg-surface border border-rim p-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.chroniclerDetail.originalSection}</h2>
          {c.texts.map((text, i) => (
            <p key={i} className="text-sm text-ink whitespace-pre-wrap">{text}</p>
          ))}
          {c.photoUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {c.photoUrls.map((url) => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-surface-high">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
          {c.voices.length > 0 && (
            <div className="space-y-2">
              {c.voices.map((v, i) => (
                <div key={v.url} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <audio src={v.url} controls className="flex-1 h-8 min-w-0" />
                    <button
                      type="button"
                      onClick={() => handleTranscribeVoice(i)}
                      disabled={transcribingVoiceIndex === i}
                      className="shrink-0 flex items-center gap-1.5 rounded-lg border border-rim px-2.5 py-1.5 text-xs text-ink-dim hover:bg-surface-high hover:text-ink disabled:opacity-50 disabled:pointer-events-none transition-colors"
                    >
                      {transcribingVoiceIndex === i
                        ? <><SpinnerIcon />{t.chroniclerDetail.transcribingBtn}</>
                        : t.chroniclerDetail.transcribeBtn}
                    </button>
                  </div>
                  {transcribeVoiceError?.index === i && (
                    <p className="text-xs text-danger">{t.chroniclerDetail.transcribeError(transcribeVoiceError.msg)}</p>
                  )}
                  {voiceTranscripts[i] && (
                    <p className="text-xs text-ink-dim italic leading-relaxed">{voiceTranscripts[i]}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {c.location && (
            <a href={`https://maps.google.com/?q=${c.location.latitude},${c.location.longitude}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-gold hover:underline">
              📍 {c.locationName ?? `${c.location.latitude.toFixed(5)}, ${c.location.longitude.toFixed(5)}`}
            </a>
          )}
        </section>

        {/* Chronicler additions */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-ink">{t.chroniclerDetail.additionsSection}</h2>

          <div>
            <label className="block text-sm font-medium text-ink-dim mb-1.5">{t.chroniclerDetail.verifiedDateLabel}</label>
            <input type="date" value={verifiedDate} onChange={(e) => setVerifiedDate(e.target.value)} className={INPUT_CLS} />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-dim mb-1.5">{t.chroniclerDetail.chroniclerTextLabel}</label>
            <textarea value={chroniclerText} onChange={(e) => setChroniclerText(e.target.value)}
              placeholder={t.chroniclerDetail.chroniclerTextPlaceholder} rows={4} className={`${INPUT_CLS} resize-none`} />
          </div>

          {c.voices.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-ink-dim">
                {t.chroniclerDetail.voiceTranscriptLabel(c.voices.length)}
              </label>
              {c.voices.map((_, i) => (
                <textarea
                  key={i}
                  value={voiceTranscripts[i] ?? ""}
                  onChange={(e) => setVoiceTranscripts((prev) => { const next = [...prev]; next[i] = e.target.value; return next; })}
                  placeholder={t.chroniclerDetail.voiceTranscriptPlaceholder(i, c.voices.length)}
                  rows={2}
                  className={`${INPUT_CLS} resize-none`}
                />
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ink-dim mb-2">{t.chroniclerDetail.chroniclerPhotosLabel}</label>
            <PhotoUploader photos={newPhotos} existingUrls={existingChroniclerPhotos} onChange={setNewPhotos}
              onDeleteExisting={(url) => setExistingChroniclerPhotos((prev) => prev.filter((u) => u !== url))} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-ink-dim">{t.chroniclerDetail.chroniclerVoiceLabel}</label>
            <VoiceRecorder existingUrl={c.chroniclerVoiceUrl} maxSeconds={300} onRecorded={setVoiceBlob} onDelete={() => setVoiceBlob(null)} />
            {c.chroniclerVoiceUrl && (
              <>
                <button
                  type="button"
                  onClick={() => handleTranscribeChroniclerVoice()}
                  disabled={transcribingChroniclerVoice}
                  className="flex items-center gap-1.5 rounded-lg border border-rim px-2.5 py-1.5 text-xs text-ink-dim hover:bg-surface-high hover:text-ink disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                  {transcribingChroniclerVoice
                    ? <><SpinnerIcon />{t.chroniclerDetail.transcribingBtn}</>
                    : t.chroniclerDetail.transcribeBtn}
                </button>
                {transcribeChroniclerError && (
                  <p className="text-xs text-danger">{t.chroniclerDetail.transcribeError(transcribeChroniclerError)}</p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-dim mb-1.5">{t.chroniclerDetail.chroniclerVoiceTranscriptLabel}</label>
            <textarea
              value={chroniclerVoiceTranscript}
              onChange={(e) => setChroniclerVoiceTranscript(e.target.value)}
              placeholder={t.chroniclerDetail.chroniclerVoiceTranscriptPlaceholder}
              rows={2}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-ink-dim mb-2">{t.chroniclerDetail.groupLabel}</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      setSelectedCategories((prev) =>
                        prev.includes(cat.id) ? prev.filter((cid) => cid !== cat.id) : [...prev, cat.id]
                      )
                    }
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-colors border ${
                      selectedCategories.includes(cat.id)
                        ? "border-transparent text-gold-text"
                        : "bg-transparent text-ink-dim border-rim hover:border-rim-strong"
                    }`}
                    style={selectedCategories.includes(cat.id) ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                  >
                    {cat.icon ? cat.icon + " " + cat.name : cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-ink-dim mb-2">{t.chroniclerDetail.hashtagsLabel}</label>
              <div className="flex flex-wrap gap-2">
                {tags
                  .filter((tag) =>
                    selectedTags.includes(tag.id) ||
                    tag.categoryIds.length === 0 ||
                    tag.categoryIds.some((cid) => selectedCategories.includes(cid))
                  )
                  .map((tag) => (
                    <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                      className={`rounded-full px-3 py-1 text-sm transition-colors border ${
                        selectedTags.includes(tag.id)
                          ? "bg-gold-dim text-gold border-gold/40"
                          : "bg-transparent text-ink-dim border-rim hover:border-rim-strong"
                      }`}>
                      {tag.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </section>

        {/* Assign to group / event */}
        <section className="rounded-xl border border-rim bg-surface p-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.chroniclerDetail.assignSection}</h2>

          {(linkedGroups.length > 0 || linkedEvents.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {linkedGroups.map((group) => (
                <Link
                  key={group.id}
                  href="/chronicler"
                  className="flex items-center gap-1.5 rounded-lg bg-surface-high border border-rim px-2.5 py-1.5 text-xs text-ink hover:border-gold hover:text-gold"
                >
                  <FolderIcon /> {group.title}
                </Link>
              ))}
              {linkedEvents.map((event) => (
                <div key={event.id} className="flex items-center rounded-lg bg-gold-dim border border-gold/30 overflow-hidden">
                  <Link
                    href={`/chronicler/events/${event.id}`}
                    className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 text-xs text-gold hover:bg-gold/10"
                  >
                    <CalendarIcon /> {event.title}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRemoveFromEvent(event.id)}
                    className="px-2 py-1.5 text-gold/40 hover:text-danger hover:bg-danger-dim border-l border-gold/20 transition-colors"
                    title={t.chroniclerDetail.removeFromEvent}
                  >
                    <XSmallIcon />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setGroupPickerOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-rim px-3 py-2 text-sm text-ink-dim hover:bg-surface-high hover:text-ink"
            >
              <FolderIcon /> {t.chroniclerDetail.addToGroupBtn}
            </button>
            <button
              type="button"
              onClick={() => setEventPickerOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-rim px-3 py-2 text-sm text-ink-dim hover:bg-surface-high hover:text-ink"
            >
              <CalendarIcon /> {t.chroniclerDetail.addToEventBtn}
            </button>
          </div>
          {assignedFeedback && (
            <p className="text-xs text-success font-medium">✓ {assignedFeedback}</p>
          )}
        </section>
      </main>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-rim px-4 py-3 flex gap-3">
        <Button variant="secondary" className="flex-1" loading={saving} onClick={() => handleSave(false)}>
          {saved ? t.chroniclerDetail.savedBtn : t.chroniclerDetail.saveBtn}
        </Button>
        <Button variant="primary" className="flex-1" loading={saving} onClick={() => handleSave(true)}>
          {t.chroniclerDetail.markProcessedBtn}
        </Button>
      </div>

      <GroupPickerModal
        open={groupPickerOpen}
        onConfirm={handleAssignToGroup}
        onClose={() => setGroupPickerOpen(false)}
      />
      <EventPickerModal
        open={eventPickerOpen}
        onConfirm={handleAssignToEvent}
        onClose={() => setEventPickerOpen(false)}
        categories={categories}
        onCreateAndAssign={handleCreateAndAssignEvent}
      />
      <EventGroupConflictModal
        open={pendingEventConflict !== null}
        mode="single"
        eventGroupName={
          categories.find((c) => c.id === pendingEventConflict?.categoryId)?.name ??
          (pendingEventConflict?.categoryId ?? "")
        }
        contribGroupName={
          categories.find((c) => c.id === contribution?.categories[0])?.name ??
          (contribution?.categories[0] ?? "")
        }
        conflictingCount={1}
        compatibleCount={0}
        onChangeEvent={contribution && contribution.categories.length > 0 ? handleConflictChangeEvent : undefined}
        onOverwriteContrib={handleConflictOverwriteContrib}
        onCancel={() => setPendingEventConflict(null)}
      />
    </>
  );
}

export default function ChroniclerDetailPage() {
  return <RouteGuard requiredRole="chronicler"><ChroniclerDetailContent /></RouteGuard>;
}

function SpinnerIcon() {
  return (
    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function XSmallIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="2" y1="2" x2="10" y2="10" /><line x1="10" y1="2" x2="2" y2="10" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
