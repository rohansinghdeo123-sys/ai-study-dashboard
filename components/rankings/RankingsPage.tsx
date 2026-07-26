"use client";

import { useEffect, useState } from "react";
import { AppIcon, LoadingSkeleton } from "@/components/ui/Polished";
import {
  formatRankNumber,
  leaderboardDisplayName,
  learnerInitials,
  type LeaderboardEntry,
} from "@/features/rankings/leaderboard";
import {
  remainingChallengeSeconds,
  type RivalChallenge,
  type RivalMission,
} from "@/features/rankings/rival";
import { useRankings } from "@/features/rankings/useRankings";

const BATTLE_COPY: Record<
  RivalChallenge["battleStatus"],
  { label: string; message: string }
> = {
  leading: {
    label: "You are winning",
    message: "Keep your lead — every focused session counts.",
  },
  trailing: {
    label: "Rival ahead",
    message: "One strong session can flip this battle.",
  },
  tied: {
    label: "Dead heat",
    message: "Perfectly tied. The next session takes the lead.",
  },
  unmatched: {
    label: "Open week",
    message: "No rival this week — race your own record instead.",
  },
};

function formatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return `${hours}h ${minutes}m ${String(Math.floor(seconds % 60)).padStart(2, "0")}s`;
}

function formatActivityTime(value: string) {
  const time = new Date(value).getTime();
  if (!value || !Number.isFinite(time)) return "This week";
  const minutes = Math.max(1, Math.round((Date.now() - time) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function getLevelLabel(level: number) {
  if (level >= 10) return "Master";
  if (level >= 7) return "Advanced";
  if (level >= 4) return "Intermediate";
  return "Beginner";
}

function LastWeekBanner({
  lastWeek,
  badge,
}: {
  lastWeek: NonNullable<RivalChallenge["lastWeek"]>;
  badge: string;
}) {
  const tone =
    lastWeek.outcome === "won"
      ? "won"
      : lastWeek.outcome === "tied"
        ? "tied"
        : "lost";
  const message =
    tone === "won"
      ? `You beat ${lastWeek.rival_name} last week — +${lastWeek.reward_xp} XP · ${badge}`
      : tone === "tied"
        ? `Last week ended level with ${lastWeek.rival_name} — +${lastWeek.reward_xp} XP each`
        : `${lastWeek.rival_name} took last week. New week, clean slate.`;

  return (
    <div className="dashboard-rival-lastweek" data-tone={tone} role="status">
      <AppIcon name={tone === "won" ? "spark" : "history"} />
      <p>{message}</p>
    </div>
  );
}

function RivalBattleCard({
  challenge,
  displayName,
  secondsLeft,
}: {
  challenge: RivalChallenge;
  displayName: string;
  secondsLeft: number;
}) {
  const rivalName = challenge.rival?.name || "Awaiting rival";
  const totalXp = Math.max(1, challenge.myWeekXp + challenge.rivalWeekXp);
  const myShare = challenge.rival
    ? Math.round((challenge.myWeekXp / totalXp) * 100)
    : 100;
  const copy = BATTLE_COPY[challenge.battleStatus];

  return (
    <article
      className="dashboard-final-panel dashboard-rival-battle"
      data-status={challenge.battleStatus}
    >
      <div className="dashboard-rival-battle-top">
        <div>
          <p className="dashboard-section-kicker">Weekly Rival Challenge</p>
          <h2>
            {challenge.rival ? (
              <>
                You <span>vs</span> {rivalName}
              </>
            ) : (
              "Your open training week"
            )}
          </h2>
          <p className="dashboard-rival-battle-message">{copy.message}</p>
        </div>
        <div
          className="dashboard-rival-countdown"
          role="timer"
          aria-label="Time left this week"
        >
          <span className="dashboard-rival-live-dot" aria-hidden="true" />
          <div>
            <strong>{formatCountdown(secondsLeft)}</strong>
            <small>left this week</small>
          </div>
        </div>
      </div>

      <div className="dashboard-rival-versus" aria-label="Weekly XP comparison">
        <div className="dashboard-rival-side" data-side="me">
          <span className="dashboard-rival-avatar" aria-hidden="true">
            {learnerInitials(displayName)}
          </span>
          <div>
            <p>{displayName.split(" ")[0] || "You"}</p>
            <strong>{formatRankNumber(challenge.myWeekXp)} XP</strong>
            <small>
              {challenge.me.sessions} sessions · {challenge.me.accuracy}% acc ·{" "}
              {challenge.me.active_days}/7 days
            </small>
          </div>
        </div>

        <div
          className="dashboard-rival-status-chip"
          data-status={challenge.battleStatus}
        >
          <strong>{copy.label}</strong>
          {challenge.rival && challenge.battleStatus !== "tied" ? (
            <small>by {formatRankNumber(challenge.xpGap)} XP</small>
          ) : null}
        </div>

        <div className="dashboard-rival-side" data-side="rival">
          <span className="dashboard-rival-avatar" aria-hidden="true">
            {challenge.rival ? learnerInitials(rivalName) : "?"}
          </span>
          <div>
            <p>{rivalName}</p>
            <strong>
              {challenge.rival
                ? `${formatRankNumber(challenge.rivalWeekXp)} XP`
                : "—"}
            </strong>
            <small>
              {challenge.rival
                ? `${challenge.rival.sessions} sessions · ${challenge.rival.accuracy}% acc · ${challenge.rival.active_days}/7 days`
                : "Matched from monthly exam ranks"}
            </small>
          </div>
        </div>
      </div>

      {challenge.rival ? (
        <div
          className="dashboard-rival-tug"
          role="progressbar"
          aria-label={`Your share of this week's battle XP: ${myShare}%`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={myShare}
        >
          <span style={{ width: `${Math.max(4, Math.min(96, myShare))}%` }} />
        </div>
      ) : null}

      <div className="dashboard-rival-battle-foot">
        <span className="dashboard-rival-reward">
          <AppIcon name="spark" />
          Weekly prize: +{challenge.rewardWinXp} XP · {challenge.rewardBadge}
        </span>
        <span className="dashboard-rival-basis">
          Rivals are matched by Monthly Exam performance and stay fixed all week.
        </span>
      </div>
    </article>
  );
}

function MissionBoard({ missions }: { missions: RivalMission[] }) {
  const completeCount = missions.filter((mission) => mission.completed).length;

  return (
    <article className="dashboard-final-panel dashboard-rival-missions">
      <div className="dashboard-final-panel-header">
        <div>
          <p className="dashboard-section-kicker">Today&apos;s Missions</p>
          <h2>What to complete today</h2>
          <p>Missions update from your real learning activity.</p>
        </div>
        <div className="dashboard-final-panel-actions">
          <span>
            {completeCount}/{missions.length} done
          </span>
        </div>
      </div>

      {missions.length ? (
        <ol className="dashboard-rival-mission-list">
          {missions.map((mission) => {
            const percent = Math.round(
              Math.min(1, mission.progress / mission.target) * 100,
            );
            return (
              <li
                key={mission.id}
                data-completed={mission.completed ? "true" : "false"}
              >
                <span className="dashboard-rival-mission-check" aria-hidden="true">
                  {mission.completed ? <AppIcon name="check" /> : null}
                </span>
                <div className="dashboard-rival-mission-main">
                  <p>{mission.title}</p>
                  <small>{mission.detail}</small>
                  <div
                    className="dashboard-rival-mission-bar"
                    role="progressbar"
                    aria-label={`${mission.title} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                  >
                    <span
                      style={{
                        width: `${Math.max(mission.completed ? 100 : 3, percent)}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="dashboard-rival-mission-state">
                  {mission.completed ? "Done" : `${percent}%`}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="px-5 pb-5 text-sm text-slate-500">
          Your next missions will appear as the weekly challenge updates.
        </p>
      )}
    </article>
  );
}

function RivalPulse({ challenge }: { challenge: RivalChallenge }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const peak = Math.max(
    1,
    ...challenge.me.daily_xp,
    ...(challenge.rival?.daily_xp ?? [0]),
  );

  return (
    <article className="dashboard-final-panel dashboard-rival-activity">
      <div className="dashboard-final-panel-header">
        <div>
          <p className="dashboard-section-kicker">Battle Pulse</p>
          <h2>This week, day by day</h2>
          <p>Your XP against your rival&apos;s, updating live.</p>
        </div>
      </div>
      <div className="dashboard-rival-week-chart" aria-hidden="true">
        {days.map((day, index) => (
          <div className="dashboard-rival-week-day" key={day}>
            <div className="dashboard-rival-week-bars">
              <span
                data-series="me"
                style={{
                  height: `${Math.max(4, Math.round(((challenge.me.daily_xp[index] || 0) / peak) * 100))}%`,
                }}
              />
              {challenge.rival ? (
                <span
                  data-series="rival"
                  style={{
                    height: `${Math.max(4, Math.round(((challenge.rival.daily_xp[index] || 0) / peak) * 100))}%`,
                  }}
                />
              ) : null}
            </div>
            <small>{day}</small>
          </div>
        ))}
      </div>
      {challenge.rival ? (
        <>
          <div className="dashboard-rival-legend" aria-hidden="true">
            <span data-series="me">You</span>
            <span data-series="rival">{challenge.rival.name}</span>
          </div>
          <ul className="dashboard-rival-feed">
            {challenge.rival.activity.length ? (
              challenge.rival.activity.slice(0, 4).map((item, index) => (
                <li key={`${item.completed_at}-${index}`}>
                  <span className="dashboard-rival-feed-dot" aria-hidden="true" />
                  <p>
                    {challenge.rival?.name} finished <strong>{item.type}</strong>
                    {item.topic ? ` on ${item.topic}` : ""}
                  </p>
                  <small>
                    +{item.xp_earned} XP · {formatActivityTime(item.completed_at)}
                  </small>
                </li>
              ))
            ) : (
              <li data-empty="true">
                <p>No rival activity yet this week — strike first.</p>
              </li>
            )}
          </ul>
        </>
      ) : null}
    </article>
  );
}

function LeaderboardRow({
  entry,
  currentUserId,
  currentDisplayName,
}: {
  entry: LeaderboardEntry;
  currentUserId: string;
  currentDisplayName: string;
}) {
  const isCurrent = entry.user_id === currentUserId;
  const displayName = leaderboardDisplayName(
    entry,
    currentUserId,
    currentDisplayName,
  );
  const level = Math.floor(entry.xp / 100) + 1;

  return (
    <li
      className="dashboard-leaderboard-row"
      data-current={isCurrent ? "true" : "false"}
    >
      <div
        className="dashboard-rank-cell"
        data-rank={entry.rank <= 3 ? entry.rank : undefined}
      >
        <strong>{entry.rank}</strong>
      </div>
      <div className="dashboard-student-cell">
        <span className="dashboard-student-avatar" aria-hidden="true">
          {learnerInitials(displayName)}
        </span>
        <span className="min-w-0">
          <span className="dashboard-student-name">
            {displayName}
            {isCurrent ? <span className="dashboard-you-label">You</span> : null}
          </span>
          <span className="dashboard-student-note">
            {entry.class_level
              ? `${entry.class_level}${entry.class_rank ? ` · Class rank #${entry.class_rank}` : ""}`
              : `${entry.total_tests} completed tests`}
          </span>
          <span className="dashboard-student-mobile-meta">
            Level {level} · {entry.streak} day streak
          </span>
        </span>
      </div>
      <div className="dashboard-leaderboard-stat dashboard-leaderboard-level">
        <strong>{level}</strong>
        <span>{getLevelLabel(level)}</span>
      </div>
      <div className="dashboard-leaderboard-stat dashboard-leaderboard-streak">
        <strong>
          <AppIcon name="clock" />
          {entry.streak} d
        </strong>
        <span>Current</span>
      </div>
      <div className="dashboard-leaderboard-xp">
        <strong>{formatRankNumber(entry.xp)}</strong>
        <span>XP</span>
      </div>
    </li>
  );
}

function RankingsLoading() {
  return (
    <div className="mx-auto min-h-full w-full space-y-5 py-4">
      <LoadingSkeleton className="h-24 rounded-[1.5rem]" />
      <LoadingSkeleton className="h-72 rounded-[1.5rem]" />
      <LoadingSkeleton className="h-[32rem] rounded-[1.5rem]" />
    </div>
  );
}

export function RankingsPage() {
  const {
    entries,
    challenge,
    currentEntry,
    currentDisplayName,
    userId,
    loading,
    error,
    retry,
  } = useRankings();
  const [clockTime, setClockTime] = useState(() => Date.now());

  useEffect(() => {
    if (!challenge) return;
    const timer = window.setInterval(() => setClockTime(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  const secondsLeft = challenge
    ? remainingChallengeSeconds(challenge, clockTime)
    : 0;

  if (loading) return <RankingsLoading />;

  return (
    <div className="dashboard-overview dashboard-final-overview mx-auto min-h-full w-full space-y-5">
      <header className="agentify-card flex flex-col gap-4 rounded-[1.5rem] border border-[var(--agentify-border)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="dashboard-section-kicker">Global Rankings</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--agentify-primary-text)]">
            Weekly rival and leaderboard
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--agentify-muted-text)]">
            {formatRankNumber(entries.length)} learners
          </span>
          {currentEntry ? (
            <strong className="rounded-full border border-teal-300/30 bg-teal-500/10 px-4 py-2 text-sm text-teal-700">
              Your rank #{currentEntry.rank}
            </strong>
          ) : null}
          {error ? (
            <button
              type="button"
              onClick={retry}
              className="agentify-action rounded-full border border-amber-300/40 px-4 py-2 text-xs font-semibold text-amber-700"
            >
              Retry
            </button>
          ) : null}
        </div>
      </header>

      <section className="dashboard-rival-section" aria-label="Weekly Rival Challenge">
        {challenge?.lastWeek ? (
          <LastWeekBanner
            lastWeek={challenge.lastWeek}
            badge={challenge.rewardBadge}
          />
        ) : null}

        {challenge ? (
          <>
            <RivalBattleCard
              challenge={challenge}
              displayName={currentDisplayName}
              secondsLeft={secondsLeft}
            />
            <div className="dashboard-rival-columns">
              <MissionBoard missions={challenge.missions} />
              <RivalPulse challenge={challenge} />
            </div>
          </>
        ) : (
          <article
            className="dashboard-final-panel dashboard-rival-battle"
            data-status="unmatched"
            role="status"
          >
            <div className="dashboard-rival-battle-top">
              <div>
                <p className="dashboard-section-kicker">Weekly Rival Challenge</p>
                <h2>Rival battle unavailable right now</h2>
                <p className="dashboard-rival-battle-message">
                  Your leaderboard remains available while the weekly challenge reconnects.
                </p>
              </div>
            </div>
          </article>
        )}
      </section>

      <section
        className="dashboard-final-panel dashboard-final-leaderboard"
        aria-labelledby="leaderboard-title"
        data-ranking-scope="all-active-students"
      >
        <div className="dashboard-final-panel-header">
          <div>
            <h2 id="leaderboard-title">Student Leaderboard</h2>
            <p>Ranked by total XP, then streak and completed tests.</p>
          </div>
          <div className="dashboard-final-panel-actions">
            <span>All time</span>
          </div>
        </div>

        <div className="dashboard-leaderboard-columns" aria-hidden="true">
          <span>Rank</span>
          <span>Student</span>
          <span>Level</span>
          <span>Streak</span>
          <span>XP</span>
        </div>

        {entries.length ? (
          <ol className="dashboard-leaderboard-list">
            {entries.map((entry) => (
              <LeaderboardRow
                key={entry.user_id}
                entry={entry}
                currentUserId={userId}
                currentDisplayName={currentDisplayName}
              />
            ))}
          </ol>
        ) : (
          <p className="px-6 py-12 text-center text-sm text-[var(--agentify-muted-text)]">
            No ranked learners are available yet.
          </p>
        )}
      </section>
    </div>
  );
}
