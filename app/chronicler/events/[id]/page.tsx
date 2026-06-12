"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { Button } from "@/components/ui/Button";
import { PageSpinner } from "@/components/ui/Spinner";
import { ConfirmModal } from "@/components/ui/Modal";
import { getContribution, updateContributionByChronicler } from "@/lib/contributionService";
import {
  getEvent,
  updateEvent,
  addContributionsToEvent,
  removeContributionFromEvent,
  deleteEvent,
  setEventHiddenItems,
  setEventEntityOrder,
  addEventEditor,
  removeEventEditor,
} from "@/lib/eventService";
import { getCategories } from "@/lib/categoryService";
import { getAllUsers } from "@/lib/userService";
import { ContributionPickerModal } from "@/components/ui/ContributionPickerModal";
import { GroupPickerModal } from "@/components/ui/GroupPickerModal";
import { UserPickerModal } from "@/components/ui/UserPickerModal";
import { GroupConflictModal } from "@/components/ui/GroupConflictModal";
import { checkCategoryConflict, getEffectiveCategoryId } from "@/lib/categoryConflictUtils";
import type { ChronicleEvent, Contribution, EventGroup, Group } from "@/types/contribution";
import type { AppUser } from "@/types/user";

const INPUT_CLS =
  "w-full rounded-xl border border-rim bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold";

// ── Entity model ──────────────────────────────────────────────────────────────

type EntityType =
  | "text"
  | "voiceUrl"
  | "chroniclerText"
  | "chroniclerVoiceUrl"
  | "photos";

interface Entity {
  key: string;
  type: EntityType;
  contribution: Contribution;
}

const ENTITY_TYPE_ORDER: EntityType[] = [
  "text",
  "voiceUrl",
  "chroniclerText",
  "chroniclerVoiceUrl",
  "photos",
];

const ENTITY_LABELS: Record<EntityType, string> = {
  text: "Text",
  voiceUrl: "Hlasová správa",
  chroniclerText: "Text kronikára",
  chroniclerVoiceUrl: "Hlas kronikára",
  photos: "Fotografie",
};

function buildEntities(contributions: Contribution[], entityOrder: string[]): Entity[] {
  const dateSorted = [...contributions].sort(
    (a, b) =>
      (a.verifiedEventDate ?? a.eventDate).getTime() -
      (b.verifiedEventDate ?? b.eventDate).getTime()
  );

  const all: Entity[] = [];
  for (const c of dateSorted) {
    const photos = [...c.chroniclerPhotoUrls, ...c.photoUrls];
    for (const type of ENTITY_TYPE_ORDER) {
      if (type === "text" && c.texts.length > 0) all.push({ key: `${c.id}:text`, type, contribution: c });
      else if (type === "voiceUrl" && c.voices.length > 0) all.push({ key: `${c.id}:voiceUrl`, type, contribution: c });
      else if (type === "chroniclerText" && c.chroniclerText) all.push({ key: `${c.id}:chroniclerText`, type, contribution: c });
      else if (type === "chroniclerVoiceUrl" && (c.chroniclerVoiceUrl || c.chroniclerVoiceTranscript)) all.push({ key: `${c.id}:chroniclerVoiceUrl`, type, contribution: c });
      else if (type === "photos" && photos.length > 0) all.push({ key: `${c.id}:photos`, type, contribution: c });
    }
  }

  if (entityOrder.length === 0) return all;

  const map = new Map(all.map((e) => [e.key, e]));
  const ordered = entityOrder.flatMap((k) => (map.has(k) ? [map.get(k)!] : []));
  all.forEach((e) => { if (!entityOrder.includes(e.key)) ordered.push(e); });
  return ordered;
}

// ── Page ──────────────────────────────────────────────────────────────────────

function EventDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [event, setEvent] = useState<ChronicleEvent | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [locationName, setLocationName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [hiddenItems, setHiddenItems] = useState<string[]>([]);
  const [entityOrder, setEntityOrder] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addContribOpen, setAddContribOpen] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [allCategories, setAllCategories] = useState<Group[]>([]);
  const [editors, setEditors] = useState<AppUser[]>([]);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [pendingConflict, setPendingConflict] = useState<{
    dominantCategoryId: string;
    compatible: string[];
    conflicting: string[];
    onProceed: (ids: string[]) => Promise<void>;
  } | null>(null);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadData() {
    try {
      const [ev, allCats, allUsers] = await Promise.all([
        getEvent(id),
        getCategories(),
        getAllUsers(),
      ]);
      setAllCategories(allCats ?? []);
      if (!ev) { setLoading(false); return; }
      setEvent(ev);
      setTitle(ev.title ?? "");
      setLocationName(ev.locationName ?? "");
      setDateFrom(ev.dateFrom ? format(ev.dateFrom, "yyyy-MM-dd") : "");
      setDateTo(ev.dateTo ? format(ev.dateTo, "yyyy-MM-dd") : "");
      setDescription(ev.description ?? "");
      setCategoryId(ev.categoryId ?? null);
      setHiddenItems(Array.isArray(ev.hiddenItems) ? ev.hiddenItems : []);
      setEntityOrder(Array.isArray(ev.entityOrder) ? ev.entityOrder : []);
      const editorIds = Array.isArray(ev.editorIds) ? ev.editorIds : [];
      setEditors((allUsers ?? []).filter((u) => u != null && editorIds.includes(u.uid)));
      const contribIds = Array.isArray(ev.contributionIds) ? ev.contributionIds : [];
      const fetched = await Promise.all(contribIds.map((cid) => getContribution(cid)));
      setContributions(fetched.filter((c): c is Contribution => c !== null));
      setLoading(false);
    } catch (err) {
      console.error("[loadData]", err);
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!title.trim() || !categoryId) return;
    setSaving(true);
    await updateEvent(id, {
      title: title.trim(),
      locationName: locationName.trim() || null,
      dateFrom: dateFrom ? new Date(dateFrom) : null,
      dateTo: dateTo ? new Date(dateTo) : null,
      description: description.trim() || null,
      categoryId,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleRemoveMember(contributionId: string) {
    await removeContributionFromEvent(id, contributionId);
    setContributions((prev) => prev.filter((c) => c.id !== contributionId));
    setEvent((prev) =>
      prev ? { ...prev, contributionIds: (prev.contributionIds ?? []).filter((x) => x !== contributionId) } : prev
    );
  }

  async function doAddContributions(ids: string[]) {
    await addContributionsToEvent(id, ids);
    const ev = await getEvent(id);
    if (!ev) return;
    setEvent(ev);
    const fetched = await Promise.all(ev.contributionIds.map((cid) => getContribution(cid)));
    setContributions(fetched.filter((c): c is Contribution => c !== null));
  }

  async function handleAddContributions(ids: string[], selectedContribs: Contribution[]) {
    const allContribs = [...contributions, ...selectedContribs];
    const conflict = checkCategoryConflict(ids, event?.contributionIds ?? [], allContribs);
    if (conflict.hasConflict && conflict.dominantCategoryId) {
      setPendingConflict({ dominantCategoryId: conflict.dominantCategoryId, compatible: conflict.compatible, conflicting: conflict.conflicting, onProceed: doAddContributions });
      setConflictOpen(true);
    } else {
      await doAddContributions(ids);
    }
  }

  async function handleAddGroup(group: EventGroup) {
    const newIds = group.contributionIds.filter((cid) => !event?.contributionIds.includes(cid));
    if (newIds.length === 0) return;
    const fetched = await Promise.all(newIds.map((cid) => getContribution(cid)));
    const groupContribs = fetched.filter((c): c is Contribution => c !== null);
    const allContribs = [...contributions, ...groupContribs];
    const conflict = checkCategoryConflict(newIds, event?.contributionIds ?? [], allContribs);
    if (conflict.hasConflict && conflict.dominantCategoryId) {
      setPendingConflict({ dominantCategoryId: conflict.dominantCategoryId, compatible: conflict.compatible, conflicting: conflict.conflicting, onProceed: doAddContributions });
      setConflictOpen(true);
    } else {
      await doAddContributions(newIds);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    await deleteEvent(id);
    router.replace("/chronicler");
  }

  async function handleAddEditor(user: AppUser) {
    await addEventEditor(id, user.uid);
    setEditors((prev) => [...prev, user]);
    setEvent((prev) => prev ? { ...prev, editorIds: [...prev.editorIds, user.uid] } : prev);
  }

  async function handleRemoveEditor(uid: string) {
    await removeEventEditor(id, uid);
    setEditors((prev) => prev.filter((u) => u.uid !== uid));
    setEvent((prev) => prev ? { ...prev, editorIds: (prev.editorIds ?? []).filter((x) => x !== uid) } : prev);
  }

  async function toggleHidden(key: string) {
    const updated = hiddenItems.includes(key)
      ? hiddenItems.filter((k) => k !== key)
      : [...hiddenItems, key];
    setHiddenItems(updated);
    await setEventHiddenItems(id, updated);
  }

  async function toggleHiddenSub(key: string, sub: "audio" | "transcript") {
    const subKey = `${key}:${sub}`;
    const updated = hiddenItems.includes(subKey)
      ? hiddenItems.filter((k) => k !== subKey)
      : [...hiddenItems, subKey];
    setHiddenItems(updated);
    await setEventHiddenItems(id, updated);
  }

  async function moveEntity(entities: Entity[], currentIndex: number, direction: -1 | 1) {
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= entities.length) return;
    const newOrder = entities.map((e) => e.key);
    [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];
    setEntityOrder(newOrder);
    await setEventEntityOrder(id, newOrder);
  }

  if (loading) return <><NavBar /><PageSpinner /></>;
  if (!event) {
    return (
      <>
        <NavBar />
        <div className="p-8 text-center text-ink-dim">Udalosť neexistuje.</div>
      </>
    );
  }

  const effectiveCategoryId = getEffectiveCategoryId(event.contributionIds, contributions);
  const effectiveCategory = effectiveCategoryId
    ? allCategories.find((c) => c.id === effectiveCategoryId) ?? null
    : null;

  const entities = buildEntities(contributions, entityOrder);

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-6 pb-28 space-y-6">
        {/* Back */}
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="rounded-lg p-1.5 text-ink-subtle hover:text-ink">
            <BackIcon />
          </button>
          <h1 className="flex-1 text-base font-semibold text-ink truncate">{event.title}</h1>
          <button
            onClick={() => setDeleteOpen(true)}
            className="rounded-lg p-1.5 text-ink-subtle hover:text-danger hover:bg-danger-dim"
            title="Odstrániť udalosť"
          >
            <TrashIcon />
          </button>
        </div>

        {/* Metadata form */}
        <section className="rounded-xl border border-rim bg-surface p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Informácie o udalosti</h2>
            {effectiveCategory ? (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium text-gold-text" style={{ backgroundColor: effectiveCategory.color }}>
                {effectiveCategory.name}
              </span>
            ) : (
              <span className="text-xs text-ink-subtle">Bez skupiny</span>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-dim mb-1.5">Názov udalosti <span className="text-danger">*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="napr. Letný tábor 2025" className={INPUT_CLS} />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-dim mb-1.5">Miesto udalosti</label>
            <input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="napr. Rybník Slnečné jazero, Bratislava" className={INPUT_CLS} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-dim mb-1.5">Dátum od</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-dim mb-1.5">Dátum do</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={INPUT_CLS} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-dim mb-1.5">Popis udalosti</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Krátky popis udalosti pre kroniku…" rows={4} className={`${INPUT_CLS} resize-none`} />
          </div>

          {allCategories.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-ink-dim mb-2">Skupina <span className="text-danger">*</span></label>
              <div className="flex flex-wrap gap-2">
                {allCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-colors border ${
                      categoryId === cat.id ? "border-transparent text-gold-text" : "bg-transparent text-ink-dim border-rim hover:border-rim-strong"
                    }`}
                    style={categoryId === cat.id ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                  >
                    {cat.icon ? cat.icon + " " + cat.name : cat.name}
                  </button>
                ))}
              </div>
              {!categoryId && <p className="mt-1 text-[10px] text-danger">Skupina je povinná.</p>}
            </div>
          )}
        </section>

        {/* Entity list */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Súhrn</h2>
            {entities.length > 0 && (
              <span className="text-[10px] text-ink-subtle flex items-center gap-1">
                <EyeSmallIcon /> — viditeľnosť pre užívateľov
              </span>
            )}
          </div>

          {entities.length === 0 ? (
            <div className="rounded-xl border border-rim py-12 text-center space-y-2">
              <p className="text-sm text-ink-subtle">Udalosť neobsahuje žiadne príspevky.</p>
              <p className="text-xs text-ink-subtle">
                Pridajte príspevky výberom v{" "}
                <Link href="/chronicler" className="text-gold hover:underline">zozname príspevkov</Link>.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {entities.map((entity, i) => {
                const { key, type, contribution: c } = entity;
                const hidden = hiddenItems.includes(key);
                const isChroniclerContent = type === "chroniclerText" || type === "chroniclerVoiceUrl";
                const isVoiceEntity = type === "voiceUrl" || type === "chroniclerVoiceUrl";
                const hasAudio = type === "voiceUrl" ? c.voices.length > 0 : !!c.chroniclerVoiceUrl;
                const hasTranscript = type === "voiceUrl" ? c.voices.some((v) => !!v.transcript) : !!c.chroniclerVoiceTranscript;
                const audioHidden = isVoiceEntity && hiddenItems.includes(`${key}:audio`);
                const transcriptHidden = isVoiceEntity && hiddenItems.includes(`${key}:transcript`);
                const authorLabel = isChroniclerContent
                  ? "Kronikár"
                  : `${c.contributorName} · ${format(c.recordedAt, "d.M.yyyy HH:mm", { locale: sk })}`;

                return (
                  <div
                    key={key}
                    className={`rounded-xl border bg-surface transition-opacity ${hidden ? "opacity-50 border-rim" : "border-rim"}`}
                  >
                    {/* Entity header */}
                    <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-rim">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isChroniclerContent ? "bg-gold-dim text-gold" : "bg-surface-high text-ink-dim"
                      }`}>
                        {ENTITY_LABELS[type]}
                      </span>
                      <span className="flex-1 text-[10px] text-ink-subtle truncate">{authorLabel}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Link
                          href={`/chronicler/${c.id}`}
                          className="rounded p-1 text-ink-subtle hover:text-ink transition-colors"
                          title="Otvoriť a upraviť príspevok"
                        >
                          <ExternalIcon />
                        </Link>
                        <button
                          onClick={() => setRemoveConfirmId(c.id)}
                          className="rounded p-1 text-ink-subtle hover:text-danger transition-colors"
                          title="Odstrániť príspevok z udalosti"
                        >
                          <RemoveFromEventIcon />
                        </button>
                        {isVoiceEntity && hasAudio && (
                          <button
                            onClick={() => toggleHiddenSub(key, "audio")}
                            className={`rounded p-1 text-ink-subtle hover:text-ink transition-colors ${audioHidden ? "opacity-30" : ""}`}
                            title={audioHidden ? "Zobraziť audio" : "Skryť audio"}
                          >
                            <MicSmallIcon />
                          </button>
                        )}
                        {isVoiceEntity && hasTranscript && (
                          <button
                            onClick={() => toggleHiddenSub(key, "transcript")}
                            className={`rounded p-1 text-ink-subtle hover:text-ink transition-colors ${transcriptHidden ? "opacity-30" : ""}`}
                            title={transcriptHidden ? "Zobraziť prepis" : "Skryť prepis"}
                          >
                            <AlignLeftSmallIcon />
                          </button>
                        )}
                        {entities.length > 1 && (
                          <>
                            <button
                              onClick={() => moveEntity(entities, i, -1)}
                              disabled={i === 0}
                              className="rounded p-1 text-ink-subtle hover:text-ink transition-colors disabled:opacity-20 disabled:pointer-events-none"
                              title="Posunúť hore"
                            >
                              <ChevronUpIcon />
                            </button>
                            <button
                              onClick={() => moveEntity(entities, i, 1)}
                              disabled={i === entities.length - 1}
                              className="rounded p-1 text-ink-subtle hover:text-ink transition-colors disabled:opacity-20 disabled:pointer-events-none"
                              title="Posunúť dole"
                            >
                              <ChevronDownIcon />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => toggleHidden(key)}
                          className="rounded p-1 text-ink-subtle hover:text-ink transition-colors"
                          title={hidden ? "Zobraziť" : "Skryť"}
                        >
                          {hidden ? <EyeOffSmallIcon /> : <EyeSmallIcon />}
                        </button>
                      </div>
                    </div>

                    {/* Entity content */}
                    <div className="px-3 py-3">
                      {type === "text" && (
                        <div className="space-y-1.5">
                          {c.texts.map((t, ti) => (
                            <p key={ti} className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{t}</p>
                          ))}
                        </div>
                      )}
                      {type === "voiceUrl" && (
                        <div className="space-y-2">
                          {c.voices.map((v, vi) => (
                            <div key={v.url} className="space-y-1">
                              {!audioHidden && <audio src={v.url} controls className="w-full h-8" />}
                              {!transcriptHidden && v.transcript && (
                                <p className="text-xs text-ink-dim italic leading-relaxed">{v.transcript}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {type === "chroniclerText" && (
                        <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{c.chroniclerText}</p>
                      )}
                      {type === "chroniclerVoiceUrl" && (
                        <div className="space-y-2">
                          {c.chroniclerVoiceUrl && <audio src={c.chroniclerVoiceUrl} controls className="w-full h-8" />}
                          {c.chroniclerVoiceTranscript && (
                            <p className="text-xs text-ink-dim italic leading-relaxed">{c.chroniclerVoiceTranscript}</p>
                          )}
                        </div>
                      )}
                      {type === "photos" && (() => {
                        const photos = [...c.chroniclerPhotoUrls, ...c.photoUrls];
                        return (
                          <div className={`grid gap-1.5 ${photos.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
                            {photos.map((url) => (
                              <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-surface-high">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
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
            <PlusIcon /> Pridať príspevky
          </button>
          <button
            type="button"
            onClick={() => setAddGroupOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-rim px-3 py-2 text-sm text-ink-dim hover:bg-surface-high hover:text-ink"
          >
            <FolderIcon /> Pridať skupinu
          </button>
        </section>

        {/* Editors section */}
        <section className="rounded-xl border border-rim bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Oprávnenia na editovanie</h2>
            <button
              type="button"
              onClick={() => setUserPickerOpen(true)}
              className="flex items-center gap-1 text-xs text-gold hover:text-gold/80 font-medium"
            >
              <PlusIcon /> Pridať editora
            </button>
          </div>
          {editors.length === 0 ? (
            <p className="text-xs text-ink-subtle">Žiadni oprávnení editoři. Môžete pridať používateľa, ktorý bude môcť editovať túto udalosť.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {editors.map((u) => (
                <div key={u.uid} className="flex items-center gap-1.5 rounded-full border border-rim bg-surface-high pl-2 pr-1 py-1">
                  {u.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.photoURL} alt="" className="h-4 w-4 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-rim shrink-0" />
                  )}
                  <span className="text-xs text-ink">{u.displayName || u.email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEditor(u.uid)}
                    className="ml-0.5 rounded-full p-0.5 text-ink-subtle hover:text-danger hover:bg-danger-dim"
                    title="Odobrať oprávnenie"
                  >
                    <RemoveEditorIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Sticky save */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-rim bg-surface px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <Button size="lg" className="w-full" loading={saving} disabled={!title.trim() || !categoryId} onClick={handleSave}>
            {saved ? "✓ Uložené" : "Uložiť udalosť"}
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={deleteOpen}
        title="Odstrániť udalosť"
        message={`Naozaj odstrániť udalosť „${event.title}"? Príspevky zostanú zachované.`}
        confirmLabel="Odstrániť udalosť"
        danger
        onConfirm={handleDelete}
        onClose={() => !deleting && setDeleteOpen(false)}
      />

      <ContributionPickerModal
        open={addContribOpen}
        title="Pridať príspevky do udalosti"
        alreadyIncluded={event.contributionIds}
        onConfirm={handleAddContributions}
        onClose={() => setAddContribOpen(false)}
      />

      <GroupPickerModal
        open={addGroupOpen}
        onConfirm={handleAddGroup}
        onClose={() => setAddGroupOpen(false)}
      />

      <UserPickerModal
        open={userPickerOpen}
        excludeIds={event.editorIds ?? []}
        onConfirm={handleAddEditor}
        onClose={() => setUserPickerOpen(false)}
      />

      <ConfirmModal
        open={!!removeConfirmId}
        title="Odstrániť príspevok z udalosti"
        message="Príspevok bude vyradený z tejto udalosti. Príspevok samotný zostane zachovaný."
        confirmLabel="Odstrániť"
        danger
        onConfirm={async () => {
          if (removeConfirmId) await handleRemoveMember(removeConfirmId);
          setRemoveConfirmId(null);
        }}
        onClose={() => setRemoveConfirmId(null)}
      />

      {pendingConflict && (
        <GroupConflictModal
          open={conflictOpen}
          dominantCategoryName={allCategories.find((c) => c.id === pendingConflict.dominantCategoryId)?.name ?? pendingConflict.dominantCategoryId}
          compatibleCount={pendingConflict.compatible.length}
          conflictingCount={pendingConflict.conflicting.length}
          onChangeCategory={async () => {
            await Promise.all(
              pendingConflict.conflicting.map((cid) =>
                updateContributionByChronicler(cid, { categories: [pendingConflict.dominantCategoryId] })
              )
            );
            await pendingConflict.onProceed([...pendingConflict.compatible, ...pendingConflict.conflicting]);
            setConflictOpen(false);
            setPendingConflict(null);
          }}
          onSkipConflicting={async () => {
            if (pendingConflict.compatible.length > 0) await pendingConflict.onProceed(pendingConflict.compatible);
            setConflictOpen(false);
            setPendingConflict(null);
          }}
          onCancel={() => { setConflictOpen(false); setPendingConflict(null); }}
        />
      )}
    </>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
function FolderIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>;
}
function BackIcon() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7" /></svg>;
}
function TrashIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" /></svg>;
}
function RemoveFromEventIcon() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>;
}
function ExternalIcon() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>;
}
function UnlinkIcon() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /><line x1="2" y1="2" x2="22" y2="22" /></svg>;
}
function ChevronUpIcon() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 15l-6-6-6 6" /></svg>;
}
function ChevronDownIcon() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M6 9l6 6 6-6" /></svg>;
}
function EyeSmallIcon() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function MicSmallIcon() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>;
}
function AlignLeftSmallIcon() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="21" y1="6" x2="3" y2="6" /><line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" /></svg>;
}
function EyeOffSmallIcon() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>;
}
function RemoveEditorIcon() {
  return <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
}

export default function EventDetailPage() {
  return (
    <RouteGuard requiredRole="chronicler">
      <EventDetailContent />
    </RouteGuard>
  );
}
