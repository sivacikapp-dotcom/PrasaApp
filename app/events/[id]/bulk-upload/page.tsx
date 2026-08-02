"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { PageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { getEvent } from "@/lib/eventService";
import { BulkUploadReview } from "@/components/BulkUploadReview";
import type { ChronicleEvent } from "@/types/contribution";

function BulkUploadContent() {
  const { id } = useParams<{ id: string }>();
  const { appUser } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [event, setEvent] = useState<ChronicleEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!appUser) return;
    async function load() {
      const ev = await getEvent(id);
      if (!ev) { setLoading(false); return; }

      const isPrivileged = appUser!.roles.includes("chronicler") || appUser!.roles.includes("admin");
      if (!isPrivileged && !ev.bulkUploadContributorIds.includes(appUser!.uid)) {
        setDenied(true);
        setLoading(false);
        return;
      }

      setEvent(ev);
      setLoading(false);
    }
    load();
  }, [id, appUser]);

  if (loading) return <><NavBar /><PageSpinner /></>;

  if (denied || !event) {
    return (
      <>
        <NavBar />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-2">
          <p className="text-sm font-medium text-ink-dim">
            {denied ? t.bulkUpload.noAccess : t.eventDetail.notFound}
          </p>
          <Link href={`/events/${id}`} className="text-sm text-gold hover:underline">
            {t.bulkUpload.backLink}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-6 pb-16 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/events/${id}`)} className="rounded-lg p-1.5 text-ink-subtle hover:text-ink">
            <BackIcon />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-ink truncate">{t.bulkUpload.pageTitle}</h1>
            <p className="text-xs text-ink-subtle truncate">{event.title}</p>
          </div>
        </div>

        <BulkUploadReview event={event} />
      </main>
    </>
  );
}

export default function BulkUploadPage() {
  return (
    <RouteGuard>
      <BulkUploadContent />
    </RouteGuard>
  );
}

function BackIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
