"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { Button } from "@/components/ui/Button";
import { PageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { getEvent, updateEvent, addContributionsToEvent } from "@/lib/eventService";
import { getCategories } from "@/lib/categoryService";
import { getAllContributions, getContribution } from "@/lib/contributionService";
import { ContributionPickerModal } from "@/components/ui/ContributionPickerModal";
import { GroupPickerModal } from "@/components/ui/GroupPickerModal";
import type { ChronicleEvent, Contribution, EventGroup } from "@/types/contribution";

const INPUT_CLS =
  "w-full rounded-xl border border-rim bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold";

function EventEditContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { appUser } = useAuth();
  const { t, dateFnsLocale } = useI18n();

  const [event, setEvent] = useState<ChronicleEvent | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [allowedCategoryIds, setAllowedCategoryIds] = useState<string[]>([]);
  const [accessibleContribIds, setAccessibleContribIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const [title, setTitle] = useState("");
  const [locationName, setLocationName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addContribOpen, setAddContribOpen] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);

  useEffect(() => {
    if (!appUser) return;
    async function load() {
      const [ev, allCats, allContribs] = await Promise.all([
        getEvent(id),
        getCategories(),
        getAllContributions(),
      ]);

      if (!ev) { setLoading(false); return; }

      if (!(ev.editorIds ?? []).includes(appUser!.uid)) {
        setDenied(true);
        setLoading(false);
        return;
      }

      const allowed = allCats
        .filter((c) => c.allowedUserIds.includes(appUser!.uid))
        .map((c) => c.id);
      setAllowedCategoryIds(allowed);

      const accessible = allContribs
        .filter(
          (c) =>
            c.status === "processed" &&
            c.categories.some((cid) => allowed.includes(cid))
        )
        .map((c) => c.id);
      setAccessibleContribIds(accessible);

      setEvent(ev);
      setTitle(ev.title);
      setLocationName(ev.locationName ?? "");
      setDateFrom(ev.dateFrom ? format(ev.dateFrom, "yyyy-MM-dd") : "");
      setDateTo(ev.dateTo ? format(ev.dateTo, "yyyy-MM-dd") : "");
      setDescription(ev.description ?? "");

      const fetched = await Promise.all(ev.contributionIds.map((cid) => getContribution(cid)));
      setContributions(fetched.filter((c): c is Contribution => c !== null));
      setLoading(false);
    }
    load();
  }, [id, appUser]);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await updateEvent(id, {
      title: title.trim(),
      locationName: locationName.trim() || null,
      dateFrom: dateFrom ? new Date(dateFrom) : null,
      dateTo: dateTo ? new Date(dateTo) : null,
      description: description.trim() || null,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleAddContributions(ids: string[], _selectedContribs: Contribution[]) {
    await addContributionsToEvent(id, ids, appUser ? { uid: appUser.uid, displayName: appUser.displayName, photoURL: appUser.photoURL } : undefined);
    const ev = await getEvent(id);
    if (!ev) return;
    setEvent(ev);
    const fetched = await Promise.all(ev.contributionIds.map((cid) => getContribution(cid)));
    setContributions(fetched.filter((c): c is Contribution => c !== null));
  }

  async function handleAddGroup(group: EventGroup) {
    const newIds = group.contributionIds.filter(
      (cid) =>
        accessibleContribIds.includes(cid) &&
        !event?.contributionIds.includes(cid)
    );
    if (newIds.length === 0) return;
    await addContributionsToEvent(id, newIds, appUser ? { uid: appUser.uid, displayName: appUser.displayName, photoURL: appUser.photoURL } : undefined);
    const ev = await getEvent(id);
    if (!ev) return;
    setEvent(ev);
    const fetched = await Promise.all(ev.contributionIds.map((cid) => getContribution(cid)));
    setContributions(fetched.filter((c): c is Contribution => c !== null));
  }

  if (loading) return <><NavBar /><PageSpinner /></>;

  if (denied || !event) {
    return (
      <>
        <NavBar />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-2">
          <p className="text-sm font-medium text-ink-dim">
            {denied ? t.eventDetail.notAuthorized : t.eventDetail.notFound}
          </p>
          <button
            onClick={() => router.push("/events")}
            className="text-sm text-gold hover:underline"
          >
            {t.eventDetail.backToEvents}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-6 pb-28 space-y-6">
        {/* Back */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="rounded-lg p-1.5 text-ink-subtle hover:text-ink"
          >
            <BackIcon />
          </button>
          <h1 className="flex-1 text-base font-semibold text-ink truncate">
            {t.eventDetail.editTitle(event.title)}
          </h1>
        </div>

        {/* Metadata form */}
        <section className="rounded-xl border border-rim bg-surface p-4 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            {t.eventDetail.infoHeading}
          </h2>

          <div>
            <label className="block text-xs font-medium text-ink-dim mb-1.5">
              {t.chronicler.eventNameLabel} <span className="text-danger">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.chronicler.eventNamePlaceholder}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-dim mb-1.5">
              {t.eventDetail.locationLabel}
            </label>
            <input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder={t.eventDetail.locationPlaceholder}
              className={INPUT_CLS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-dim mb-1.5">{t.eventDetail.dateFrom}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-dim mb-1.5">{t.eventDetail.dateTo}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-dim mb-1.5">
              {t.eventDetail.descriptionLabel}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.eventDetail.descriptionPlaceholder}
              rows={4}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>
        </section>

        {/* Existing contributions */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">
            {t.eventDetail.contribsInEvent(contributions.length)}
          </h2>
          {contributions.length === 0 ? (
            <div className="rounded-xl border border-rim py-8 text-center">
              <p className="text-sm text-ink-subtle">{t.eventDetail.noContribsInEvent}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contributions.map((c) => {
                const date = c.verifiedEventDate ?? c.eventDate;
                const photoCount = c.photoUrls.length + c.chroniclerPhotoUrls.length;
                return (
                  <div key={c.id} className="rounded-xl border border-rim bg-surface px-3 py-2.5">
                    <p className="text-xs font-medium text-gold">
                      {format(date, "d. MMMM yyyy", { locale: dateFnsLocale })}
                      <span className="ml-2 font-normal text-ink-subtle">{c.contributorName}</span>
                    </p>
                    {c.texts[0] && (
                      <p className="mt-1 text-sm text-ink line-clamp-2">{c.texts[0]}</p>
                    )}
                    {!c.texts[0] && photoCount > 0 && (
                      <p className="mt-1 text-xs text-ink-subtle">{t.components.photoCount(photoCount)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Add contributions / group */}
        <section className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setAddContribOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-rim px-3 py-2 text-sm text-ink-dim hover:bg-surface-high hover:text-ink"
          >
            <PlusIcon /> {t.eventDetail.addContribsBtn}
          </button>
          <button
            type="button"
            onClick={() => setAddGroupOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-rim px-3 py-2 text-sm text-ink-dim hover:bg-surface-high hover:text-ink"
          >
            <FolderIcon /> {t.eventDetail.addGroupBtn}
          </button>
        </section>
      </main>

      {/* Sticky save */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-rim bg-surface px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <Button
            size="lg"
            className="w-full"
            loading={saving}
            disabled={!title.trim()}
            onClick={handleSave}
          >
            {saved ? t.eventDetail.savedBtn : t.eventDetail.saveBtn}
          </Button>
        </div>
      </div>

      <ContributionPickerModal
        open={addContribOpen}
        title={t.eventDetail.addContribsModalTitle}
        alreadyIncluded={event.contributionIds}
        allowedCategoryIds={allowedCategoryIds}
        onConfirm={handleAddContributions}
        onClose={() => setAddContribOpen(false)}
      />

      <GroupPickerModal
        open={addGroupOpen}
        filterContributionIds={accessibleContribIds}
        onConfirm={handleAddGroup}
        onClose={() => setAddGroupOpen(false)}
      />
    </>
  );
}

function BackIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
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

export default function EventEditPage() {
  return (
    <RouteGuard>
      <EventEditContent />
    </RouteGuard>
  );
}
