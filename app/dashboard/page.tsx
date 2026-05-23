"use client";

import Link from "next/link";
import { useState } from "react";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { ContributionCard } from "@/components/contributions/ContributionCard";
import { QuickCapture } from "@/components/QuickCapture";
import { PageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useContributionsForDashboard, useMyContributions } from "@/hooks/useContributions";

type Tab = "all" | "mine";

function DashboardContent() {
  const { appUser } = useAuth();
  const [tab, setTab] = useState<Tab>("all");

  const isContributorOnly =
    (appUser?.roles.includes("contributor") ?? false) &&
    !appUser?.roles.includes("admin") &&
    !appUser?.roles.includes("chronicler");

  const { contributions: all, loading: loadAll } = useContributionsForDashboard(appUser?.uid, isContributorOnly);
  const { contributions: mine, loading: loadMine } = useMyContributions(appUser?.uid);

  const displayed = all;
  const loading = tab === "all" ? loadAll : loadMine;

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
        {/* Quick capture — only for contributor role */}
        <QuickCapture />

        {/* Tabs */}
        <div className="mb-5 flex rounded-xl border border-rim bg-surface p-1">
          {(["all", "mine"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-gold text-gold-text shadow-sm"
                  : "text-ink-dim hover:text-ink"
              }`}
            >
              {t === "all" ? "Všetky príspevky" : "Moje príspevky"}
            </button>
          ))}
        </div>

        {loading ? (
          <PageSpinner />
        ) : tab === "mine" ? (
          <MineList contributions={mine} />
        ) : displayed.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {displayed.map((c) => (
              <ContributionCard key={c.id} contribution={c} href={`/dashboard/${c.id}`} />
            ))}
          </div>
        )}
      </main>

      {/* FAB */}
      <Link
        href="/dashboard/new"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-gold-text shadow-lg hover:bg-gold-hover active:scale-95 transition-transform"
        aria-label="Nový príspevok"
      >
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </Link>
    </>
  );
}

function MineList({ contributions }: { contributions: import("@/types/contribution").Contribution[] }) {
  const pending = contributions.filter((c) => c.status === "pending");
  const processed = contributions.filter((c) => c.status === "processed");

  if (contributions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
          <svg className="h-7 w-7 text-ink-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M9 12h6M9 16h6M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
          </svg>
        </div>
        <p className="text-sm text-ink-dim">Zatiaľ ste nepridali žiadny príspevok.</p>
        <Link href="/dashboard/new" className="text-sm font-medium text-gold hover:underline">
          Pridať prvý príspevok →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Čakajú na spracovanie
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {pending.length}
            </span>
          </div>
          <div className="space-y-3">
            {pending.map((c) => (
              <ContributionCard key={c.id} contribution={c} href={`/dashboard/${c.id}`} />
            ))}
          </div>
        </section>
      )}

      {processed.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Spracované
            </span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
              {processed.length}
            </span>
          </div>
          <div className="space-y-3">
            {processed.map((c) => (
              <ContributionCard key={c.id} contribution={c} href={`/dashboard/${c.id}`} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
        <svg className="h-7 w-7 text-ink-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M9 12h6M9 16h6M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
        </svg>
      </div>
      <p className="text-sm text-ink-dim">Žiadne príspevky.</p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RouteGuard>
      <DashboardContent />
    </RouteGuard>
  );
}
