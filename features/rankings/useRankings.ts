"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiJson, invalidateApiCache } from "@/lib/apiClient";
import {
  normalizeLeaderboard,
  type LeaderboardEntry,
} from "@/features/rankings/leaderboard";
import {
  normalizeRivalChallenge,
  type RivalChallenge,
} from "@/features/rankings/rival";

const LIVE_REFRESH_MS = 20_000;

export function useRankings() {
  const { user, profile, loading: authLoading, getAuthHeaders } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [challenge, setChallenge] = useState<RivalChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const backendURL =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  const userId = user?.uid ?? "";

  useEffect(() => {
    if (authLoading) return;

    let active = true;

    async function load(forceFresh: boolean, showLoading: boolean) {
      if (!userId) {
        setEntries([]);
        setChallenge(null);
        setError("Sign in to see the AgentifyAI rankings.");
        setLoading(false);
        return;
      }

      if (showLoading) setLoading(true);

      const headers = await getAuthHeaders();
      const [leaderboardResult, challengeResult] = await Promise.allSettled([
        apiJson<unknown>(`${backendURL}/leaderboard`, {
          headers,
          cacheKey: `leaderboard:${userId}`,
          cacheTtlMs: forceFresh ? 0 : 10_000,
          forceFresh,
          retries: 1,
          timeoutMs: 7_000,
        }),
        apiJson<unknown>(`${backendURL}/rivals/weekly-challenge/${userId}`, {
          headers,
          cacheKey: `rival-challenge:${userId}`,
          cacheTtlMs: forceFresh ? 0 : 30_000,
          forceFresh,
          retries: 1,
          timeoutMs: 9_000,
        }),
      ]);

      if (!active) return;

      if (leaderboardResult.status === "fulfilled") {
        setEntries(normalizeLeaderboard(leaderboardResult.value));
        setError(null);
      } else if (showLoading) {
        setEntries([]);
        setError(
          "Rankings could not refresh right now. Your learning progress is still safe.",
        );
      }

      if (challengeResult.status === "fulfilled") {
        setChallenge(normalizeRivalChallenge(challengeResult.value));
      } else if (showLoading) {
        setChallenge(null);
      }

      if (showLoading) setLoading(false);
    }

    void load(reloadToken > 0, true);
    const refreshTimer = window.setInterval(() => {
      void load(true, false);
    }, LIVE_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [
    authLoading,
    backendURL,
    getAuthHeaders,
    reloadToken,
    userId,
  ]);

  const currentEntry = useMemo(
    () => entries.find((entry) => entry.user_id === userId) ?? null,
    [entries, userId],
  );

  const retry = useCallback(() => {
    invalidateApiCache(`leaderboard:${userId}`);
    invalidateApiCache(`rival-challenge:${userId}`);
    setReloadToken((token) => token + 1);
  }, [userId]);

  return {
    entries,
    challenge,
    currentEntry,
    currentDisplayName: profile?.name || "Student",
    userId,
    loading: loading || authLoading,
    error,
    retry,
  };
}
