"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiJson } from "@/lib/apiClient";
import {
  normalizeLeaderboard,
  type LeaderboardEntry,
} from "@/features/rankings/leaderboard";

export function useRankings() {
  const { user, profile, loading: authLoading, getAuthHeaders } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const backendURL =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  const userId = user?.uid ?? "";

  useEffect(() => {
    let active = true;

    async function load() {
      if (authLoading) return;
      if (!userId) {
        setEntries([]);
        setError("Sign in to see the AgentifyAI rankings.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const payload = await apiJson<unknown>(`${backendURL}/leaderboard`, {
          headers: await getAuthHeaders(),
          cacheKey: `rankings:${userId}`,
          cacheTtlMs: 30_000,
          forceFresh: reloadToken > 0,
          retries: 1,
          timeoutMs: 8_000,
        });
        if (!active) return;
        setEntries(normalizeLeaderboard(payload));
      } catch {
        if (!active) return;
        setEntries([]);
        setError(
          "Rankings could not refresh right now. Your learning progress is still safe.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [authLoading, backendURL, getAuthHeaders, reloadToken, userId]);

  const currentEntry = useMemo(
    () => entries.find((entry) => entry.user_id === userId) ?? null,
    [entries, userId],
  );

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return {
    entries,
    currentEntry,
    currentDisplayName: profile?.name || "Student",
    currentClassLevel: profile?.classLevel || "",
    userId,
    loading: loading || authLoading,
    error,
    retry,
  };
}
