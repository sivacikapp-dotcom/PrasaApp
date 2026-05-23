"use client";

import { useEffect, useState } from "react";
import {
  subscribeToAllContributions,
  subscribeToMyContributions,
  subscribeToAccessibleContributions,
} from "@/lib/contributionService";
import type { Contribution } from "@/types/contribution";

export function useAllContributions() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToAllContributions((data) => {
      setContributions(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { contributions, loading };
}

export function useMyContributions(uid: string | undefined) {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    const unsub = subscribeToMyContributions(uid, (data) => {
      setContributions(data);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  return { contributions, loading };
}

/**
 * For the dashboard "Všetky" tab:
 * - contributors (no admin/chronicler role): sees only documents where their uid is in visibleToIds
 * - admin/chronicler: sees all contributions
 */
export function useContributionsForDashboard(
  uid: string | undefined,
  isContributorOnly: boolean
) {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isContributorOnly && uid) {
      const unsub = subscribeToAccessibleContributions(uid, (data) => {
        setContributions(data);
        setLoading(false);
      });
      return unsub;
    }
    const unsub = subscribeToAllContributions((data) => {
      setContributions(data);
      setLoading(false);
    });
    return unsub;
  }, [uid, isContributorOnly]);

  return { contributions, loading };
}

/** Returns the count of pending (unprocessed) contributions — used for chronicler badge */
export function usePendingCount() {
  const { contributions, loading } = useAllContributions();
  const count = contributions.filter((c) => c.status === "pending").length;
  return { count, loading };
}
