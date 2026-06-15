"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { Badge } from "@/components/ui/Badge";
import { PageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { getContribution, softDeleteContribution } from "@/lib/contributionService";
import { ConfirmModal } from "@/components/ui/Modal";
import type { Contribution } from "@/types/contribution";

function ContributionDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { appUser } = useAuth();
  const { t, dateFnsLocale } = useI18n();
  const [contribution, setContribution] = useState<Contribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getContribution(id).then((c) => { setContribution(c); setLoading(false); });
  }, [id]);

  async function handleDelete() {
    if (!appUser) return;
    setDeleting(true);
    await softDeleteContribution(id, appUser.uid);
    router.replace("/dashboard");
  }

  if (loading) return <><NavBar /><PageSpinner /></>;
  if (!contribution) return <><NavBar /><div className="p-6 text-ink-dim">{t.contribCard.notFound}</div></>;

  const c = contribution;
  const isOwner = c.contributorId === appUser?.uid;
  const displayDate = c.verifiedEventDate ?? c.eventDate;
  const allPhotos = [...c.photoUrls, ...c.chroniclerPhotoUrls];

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-ink-subtle hover:text-ink-dim">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          </button>
          <div className="flex-1">
            <p className="text-xs font-medium text-gold uppercase tracking-wide">
              {format(displayDate, "d. MMMM yyyy", { locale: dateFnsLocale })}
            </p>
            <p className="text-xs text-ink-subtle">{c.contributorName}</p>
          </div>
          <Badge color={c.status === "processed" ? "green" : "amber"}>
            {c.status === "processed" ? t.components.statusProcessed : t.components.statusPending}
          </Badge>
        </div>

        {c.texts.length > 0 && (
          <section>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.contribCard.text}</h2>
            <div className="space-y-2">
              {c.texts.map((text, i) => (
                <p key={i} className="text-sm text-ink whitespace-pre-wrap">{text}</p>
              ))}
            </div>
          </section>
        )}

        {allPhotos.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.contribCard.photos}</h2>
            <div className="grid grid-cols-2 gap-2">
              {allPhotos.map((url) => (
                <div key={url} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        {c.videoUrls?.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.contribCard.videos}</h2>
            <div className="space-y-3">
              {c.videoUrls.map((url, i) => (
                <div key={url} className="rounded-xl overflow-hidden border border-rim bg-surface">
                  <video
                    src={url}
                    controls
                    playsInline
                    className="w-full max-h-72 bg-black object-contain"
                  />
                  {c.videoUrls.length > 1 && (
                    <p className="px-3 py-1.5 text-xs text-ink-subtle">{t.contribCard.videoLabel(i)}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {(c.voices.length > 0 || c.chroniclerVoiceUrl) && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.contribCard.voices}</h2>
            <div className="space-y-2">
              {c.voices.map((v, i) => (
                <div key={v.url} className="rounded-xl bg-surface border border-rim p-3">
                  <p className="mb-1.5 text-xs text-ink-subtle">{t.contribCard.voiceLabel(c.contributorName, i, c.voices.length)}</p>
                  <audio src={v.url} controls className="w-full h-8" />
                  {v.transcript && <p className="mt-2 text-xs text-ink-dim italic">"{v.transcript}"</p>}
                </div>
              ))}
              {c.chroniclerVoiceUrl && (
                <div className="rounded-xl bg-gold-dim border border-gold/20 p-3">
                  <p className="mb-1.5 text-xs text-gold/70">{t.contribCard.chroniclerLabel}</p>
                  <audio src={c.chroniclerVoiceUrl} controls className="w-full h-8" />
                  {c.chroniclerVoiceTranscript && <p className="mt-2 text-xs text-gold/70 italic">"{c.chroniclerVoiceTranscript}"</p>}
                </div>
              )}
            </div>
          </section>
        )}

        {c.chroniclerText && (
          <section>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.contribCard.chroniclerNote}</h2>
            <p className="text-sm text-gold/80 whitespace-pre-wrap border-l-2 border-gold/40 pl-3">{c.chroniclerText}</p>
          </section>
        )}

        {c.location && (
          <section>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t.contribCard.location}</h2>
            <a
              href={`https://maps.google.com/?q=${c.location.latitude},${c.location.longitude}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gold hover:underline"
            >
              <PinIcon />
              {c.locationName ?? `${c.location.latitude.toFixed(5)}, ${c.location.longitude.toFixed(5)}`}
            </a>
          </section>
        )}

        <footer className="text-xs text-ink-subtle border-t border-rim pt-3">
          {t.contribCard.recordedAt(format(c.recordedAt, "d.M.yyyy HH:mm", { locale: dateFnsLocale }))}
        </footer>

        {isOwner && c.status === "pending" && (
          <div className="sticky bottom-4 mt-4 flex gap-3">
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-danger/40 bg-surface py-3 text-sm font-semibold text-danger hover:bg-danger/10"
            >
              {t.contribCard.deleteBtn}
            </button>
            <a href={`/dashboard/${c.id}/edit`}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold py-3 text-sm font-semibold text-gold-text shadow hover:bg-gold-hover">
              {t.contribCard.editBtn}
            </a>
          </div>
        )}
      </main>

      <ConfirmModal
        open={deleteOpen}
        title={t.contribCard.deleteTitle}
        message={t.contribCard.deleteMessage}
        confirmLabel={deleting ? t.contribCard.deleting : t.contribCard.deleteBtn}
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

export default function ContributionDetailPage() {
  return <RouteGuard><ContributionDetailContent /></RouteGuard>;
}

function PinIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}
