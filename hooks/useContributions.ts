"use client";

import { useEffect, useState } from "react";
import {
  subscribeToAllContributions,
  subscribeToMyContributions,
  subscribeToAccessibleContributions,
} from "@/lib/contributionService";
import { subscribeToEvents } from "@/lib/eventService";
import { useAuth } from "@/contexts/AuthContext";
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
    if (!uid) {
      setLoading(false);
      return;
    }
    if (isContributorOnly) {
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

/** Returns all processed contributions accessible to uid (via visibleToIds). */
export function useProcessedAccessibleContributions(uid: string | undefined) {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    const unsub = subscribeToAccessibleContributions(uid, (data) => {
      setContributions(data.filter((c) => c.status === "processed"));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  return { contributions, loading };
}

/** Returns a Set of contribution IDs that are in any chronicle event. */
export function useEventMembership(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsub = subscribeToEvents((events) => {
      const s = new Set<string>();
      events.forEach((ev) => ev.contributionIds.forEach((id) => s.add(id)));
      setIds(s);
    });
    return unsub;
  }, []);

  return ids;
}

/** Returns the count of pending contributions — only subscribes for chronicler/admin users. */
export function usePendingCount() {
  const { appUser, hasRole } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isPrivileged = hasRole("chronicler") || hasRole("admin");
    if (!appUser || !isPrivileged) {
      setLoading(false);
      return;
    }
    const unsub = subscribeToAllContributions((data) => {
      setCount(data.filter((c) => c.status === "pending").length);
      setLoading(false);
    });
    return unsub;
  }, [appUser, hasRole]);

  return { count, loading };
}
