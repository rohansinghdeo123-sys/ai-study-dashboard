"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LoadingSkeleton } from "@/components/ui/Polished";
import {
  formatRankNumber,
  leaderboardDisplayName,
  learnerInitials,
  type LeaderboardEntry,
} from "@/features/rankings/leaderboard";
import { useRankings } from "@/features/rankings/useRankings";

type RankingScope = "global" | "class";

function badgeClasses(rank: number) {
  if (rank === 1) return "border-amber-300 bg-amber-50 text-amber-800";
  if (rank === 2) return "border-slate-300 bg-slate-100 text-slate-700";
  if (rank === 3) return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-slate-200 bg-white text-slate-500";
}

function RankingsLoading() {
  return (
    <div className="mx-auto min-h-[calc(100svh-105px)] w-full max-w-[1480px] space-y-5 py-5">
      <LoadingSkeleton className="h-60 rounded-[2rem] border border-slate-200 bg-white p-6" />
      <LoadingSkeleton className="h-[34rem] rounded-[2rem] border border-slate-200 bg-white p-6" />
    </div>
  );
}

function RankRow({
  entry,
  displayedRank,
  currentUserId,
  currentDisplayName,
}: {
  entry: LeaderboardEntry;
  displayedRank: number;
  currentUserId: string;
  currentDisplayName: string;
}) {
  const isCurrent = entry.user_id === currentUserId;
  const displayName = leaderboardDisplayName(
    entry,
    currentUserId,
    currentDisplayName,
  );

  return (
    <li
      className={`grid min-h-[76px] grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-200/75 px-4 py-3 transition last:border-0 sm:grid-cols-[64px_minmax(0,1fr)_110px_90px_100px] sm:px-5 ${
        isCurrent ? "bg-teal-50/80" : "hover:bg-slate-50/80"
      }`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl border font-mono text-xs font-bold ${badgeClasses(displayedRank)}`}
        aria-label={`Rank ${displayedRank}`}
      >
        #{displayedRank}
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
            isCurrent
              ? "border-teal-300 bg-teal-100 text-teal-800"
              : "border-slate-200 bg-slate-100 text-slate-600"
          }`}
        >
          {learnerInitials(displayName)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">
              {displayName}
            </p>
            {isCurrent ? (
              <span className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-teal-700">
                You
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {entry.class_level || "Class not added yet"} / {entry.total_tests}{" "}
            {entry.total_tests === 1 ? "test" : "tests"}
          </p>
        </div>
      </div>

      <div className="hidden text-right sm:block">
        <span className="block text-[10px] uppercase tracking-[0.14em] text-slate-400">
          Class
        </span>
        <span className="mt-1 block truncate text-xs text-slate-600">
          {entry.class_level || "--"}
        </span>
      </div>

      <div className="hidden text-right sm:block">
        <span className="block text-[10px] uppercase tracking-[0.14em] text-slate-400">
          Streak
        </span>
        <span className="mt-1 block text-xs font-semibold text-slate-800">
          {entry.streak}d
        </span>
      </div>

      <div className="text-right">
        <span className="block text-[10px] uppercase tracking-[0.14em] text-slate-400">
          XP
        </span>
        <strong className="mt-1 block text-sm text-teal-700">
          {formatRankNumber(entry.xp)}
        </strong>
      </div>
    </li>
  );
}

export function RankingsPage() {
  const {
    entries,
    currentEntry,
    currentDisplayName,
    currentClassLevel,
    userId,
    loading,
    error,
    retry,
  } = useRankings();
  const [scope, setScope] = useState<RankingScope>("global");
  const [visibleCount, setVisibleCount] = useState(25);

  const classEntries = useMemo(() => {
    if (!currentClassLevel) return [];
    return entries
      .filter((entry) => entry.class_level === currentClassLevel)
      .sort(
        (left, right) =>
          (left.class_rank ?? Number.MAX_SAFE_INTEGER) -
            (right.class_rank ?? Number.MAX_SAFE_INTEGER) ||
          right.xp - left.xp,
      );
  }, [currentClassLevel, entries]);

  const scopedEntries = scope === "class" ? classEntries : entries;
  const shownEntries = scopedEntries.slice(0, visibleCount);
  const effectiveClassRank =
    currentEntry?.class_rank ??
    (classEntries.findIndex((entry) => entry.user_id === userId) + 1 || null);
  const topPercent =
    currentEntry && entries.length
      ? Math.max(1, Math.ceil((currentEntry.rank / entries.length) * 100))
      : null;

  if (loading) return <RankingsLoading />;

  return (
    <div className="mx-auto min-h-[calc(100svh-105px)] w-full max-w-[1480px] space-y-6 py-4 text-[var(--agentify-primary-text)]">
      <section className="agentify-card overflow-hidden rounded-[2rem] border border-[var(--agentify-border)] bg-[var(--agentify-card-bg)]">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700">
                Rankings
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {formatRankNumber(entries.length)} learners
              </span>
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              See where your consistency is taking you.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Compare XP and study momentum while keeping the focus on steady
              learning and stronger understanding.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/dashboard/analytics"
                className="agentify-action agentify-action-primary rounded-full px-5 py-3 text-xs font-bold uppercase tracking-[0.14em]"
              >
                View my analytics
              </Link>
              <Link
                href="/dashboard/study"
                className="agentify-action rounded-full border border-slate-200 bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Open Study Lab
              </Link>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50/70 p-6 xl:border-l xl:border-t-0">
            {currentEntry ? (
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700">
                  Your position
                </p>
                <div className="mt-4 flex items-end gap-3">
                  <strong className="text-6xl font-semibold tracking-tight text-slate-950">
                    #{currentEntry.rank}
                  </strong>
                  <span className="pb-2 text-xs text-slate-500">
                    global rank
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] text-slate-500">Class</span>
                    <strong className="mt-1 block text-sm text-slate-900">
                      {effectiveClassRank ? `#${effectiveClassRank}` : "--"}
                    </strong>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] text-slate-500">Top</span>
                    <strong className="mt-1 block text-sm text-teal-700">
                      {topPercent ? `${topPercent}%` : "--"}
                    </strong>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] text-slate-500">XP</span>
                    <strong className="mt-1 block text-sm text-teal-700">
                      {formatRankNumber(currentEntry.xp)}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-5">
                <p className="text-sm font-semibold text-slate-900">
                  Your first rank is waiting
                </p>
                <p className="mt-2 text-xs leading-6 text-slate-600">
                  Complete a tracked study or exam session to join the board.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {error ? (
        <section className="agentify-card rounded-[1.5rem] border border-slate-200 bg-white p-7 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700">
            Connection update
          </p>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">
            Rankings are taking a pause
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
            {error}
          </p>
          <button
            type="button"
            onClick={retry}
            className="agentify-action agentify-action-primary mt-5 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em]"
          >
            Try again
          </button>
        </section>
      ) : (
        <section className="agentify-card overflow-hidden rounded-[1.5rem] border border-[var(--agentify-border)] bg-[var(--agentify-card-bg)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-white/70 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                {scope === "class" ? "Your class board" : "Global board"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Ranked by XP, then streak and completed tests.
              </p>
            </div>

            <div
              className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1"
              aria-label="Ranking scope"
            >
              <button
                type="button"
                onClick={() => {
                  setScope("global");
                  setVisibleCount(25);
                }}
                className={`min-h-10 rounded-lg px-4 text-xs font-semibold transition ${
                  scope === "global"
                    ? "bg-teal-700 text-white"
                    : "text-slate-500 hover:bg-white hover:text-slate-800"
                }`}
              >
                Everyone
              </button>
              <button
                type="button"
                onClick={() => {
                  setScope("class");
                  setVisibleCount(25);
                }}
                disabled={!currentClassLevel}
                title={
                  currentClassLevel
                    ? `Show ${currentClassLevel}`
                    : "Add your class in your profile to use this view"
                }
                className={`min-h-10 rounded-lg px-4 text-xs font-semibold transition ${
                  scope === "class"
                    ? "bg-teal-700 text-white"
                    : "text-slate-500 hover:bg-white hover:text-slate-800"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                My class
              </button>
            </div>
          </div>

          {shownEntries.length ? (
            <>
              <ol aria-label="AgentifyAI learner rankings">
                {shownEntries.map((entry, index) => (
                  <RankRow
                    key={entry.user_id}
                    entry={entry}
                    displayedRank={
                      scope === "class"
                        ? entry.class_rank ?? index + 1
                        : entry.rank
                    }
                    currentUserId={userId}
                    currentDisplayName={currentDisplayName}
                  />
                ))}
              </ol>
              {visibleCount < scopedEntries.length ? (
                <div className="border-t border-slate-200 bg-slate-50/50 p-4 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((count) => count + 25)}
                    className="agentify-action min-h-11 rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Show more learners
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="bg-white/60 px-6 py-16 text-center">
              <h3 className="text-lg font-semibold text-slate-950">
                No rankings here yet
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
                {scope === "class"
                  ? `No ranked learners from ${currentClassLevel} are available yet.`
                  : "Complete a tracked learning session and check back soon."}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
