"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserPreferences, updateUserPreferences } from "@/lib/userPreferencesService";
import type { UserPreferences } from "@/types/userPreferences";
import { DEFAULT_USER_PREFERENCES } from "@/types/userPreferences";

export function useUserPreferences() {
  const { appUser } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser?.uid) return;
    getUserPreferences(appUser.uid).then((p) => {
      setPrefs(p);
      setLoading(false);
    });
  }, [appUser?.uid]);

  const save = useCallback(
    async (next: UserPreferences) => {
      if (!appUser?.uid) return;
      setPrefs(next);
      await updateUserPreferences(appUser.uid, next);
    },
    [appUser?.uid]
  );

  return { prefs, loading, updatePrefs: save };
}
