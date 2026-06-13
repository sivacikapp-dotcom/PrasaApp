"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { PageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { getEvent } from "@/lib/eventService";
import { getContribution } from "@/lib/contributionService";
import type { ChronicleEvent, Contribution } from "@/types/contribution";

const VisualTrasa = dynamic(
  () => import("@/components/trasa/VisualTrasa").then((m) => m.VisualTrasa),
  { ssr: false, loading: () => <PageSpinner /> }
);

function TrasaContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { appUser } = useAuth();
  const [event, setEvent] = useState<ChronicleEvent | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    async function load() {
      const ev = await getEvent(id);
      if (!ev) {
        setLoading(false);
        return;
      }
      setEvent(ev);
      const fetched = await Promise.all(
        ev.contributionIds.map((cid) => getContribution(cid).catch(() => null))
      );
      setContributions(fetched.filter((c): c is Contribution => c !== null));
      setLoading(false);
    }
    load();
  }, [id, appUser]);

  if (loading) {
    return (
      <>
        <NavBar />
        <PageSpinner />
      </>
    );
  }

  if (!event) {
    return (
      <>
        <NavBar />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-2">
          <p className="text-sm text-ink-dim">Udalosť nenájdená.</p>
          <button
            onClick={() => router.push("/events")}
            className="text-sm text-gold hover:underline"
          >
            Späť na udalosti
          </button>
        </div>
      </>
    );
  }

  return (
    <VisualTrasa
      eventTitle={event.title}
      contributions={contributions}
      onBack={() => router.back()}
    />
  );
}

export default function TrasaPage() {
  return (
    <RouteGuard>
      <TrasaContent />
    </RouteGuard>
  );
}
