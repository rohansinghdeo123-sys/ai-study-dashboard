"use client";

import { useAuth } from "@/context/AuthContext";
import { AlertState, AppIcon, LoadingState } from "@/components/ui/Polished";
import { apiJson, invalidateApiCache, primeBackend } from "@/lib/apiClient";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface ProgressState {
  total_tests: number;
  total_questions: number;
  total_correct: number;
  xp: number;
  streak: number;
}

interface LeaderboardEntry {
  rank: number;
  class_rank?: number | null;
  user_id: string;
  display_name?: string;
  name?: string;
  class_level?: string;
  xp: number;
  streak: number;
}

interface SessionRecord {
  id: string;
  subject: string;
  class_level?: string;
  topic: string;
  total_questions: number;
  score: number;
  xp_earned: number;
  time_spent_seconds: number;
  session_type: string;
  completed_at: string;
}

interface RivalWeekSide {
  name: string;
  class_level?: string;
  week_xp: number;
  sessions: number;
  accuracy: number;
  study_minutes: number;
  active_days: number;
  daily_xp: number[];
}

interface RivalActivityItem {
  type: string;
  topic: string;
  xp_earned: number;
  completed_at: string;
}

interface RivalMission {
  id: string;
  title: string;
  detail: string;
  target: number;
  progress: number;
  completed: boolean;
}

interface RivalChallengeState {
  weekEndUtc: string;
  secondsRemaining: number;
  fetchedAt: number;
  me: RivalWeekSide;
  rival: (RivalWeekSide & { activity: RivalActivityItem[] }) | null;
  battleStatus: "leading" | "trailing" | "tied" | "unmatched";
  myWeekXp: number;
  rivalWeekXp: number;
  xpGap: number;
  missions: RivalMission[];
  rewardWinXp: number;
  rewardBadge: string;
  lastWeek: {
    outcome: string;
    reward_xp: number;
    rival_name: string;
  } | null;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeProgress(value: unknown): ProgressState {
  const source = isRecord(value) ? value : {};
  const summary = isRecord(source.summary) ? source.summary : source;
  return {
    total_tests: toNumber(summary.total_tests ?? summary.totalTests ?? summary.sessions),
    total_questions: toNumber(summary.total_questions ?? summary.totalQuestions ?? summary.total_mcqs_attempted),
    total_correct: toNumber(summary.total_correct ?? summary.totalCorrect),
    xp: toNumber(summary.xp ?? summary.total_xp),
    streak: toNumber(summary.streak),
  };
}

function normalizeWeekSide(value: unknown): RivalWeekSide {
  const source = isRecord(value) ? value : {};
  const daily = Array.isArray(source.daily_xp) ? source.daily_xp.map((item) => toNumber(item)) : [];
  return {
    name: String(source.name || "Student"),
    class_level: source.class_level ? String(source.class_level) : undefined,
    week_xp: toNumber(source.week_xp),
    sessions: toNumber(source.sessions),
    accuracy: toNumber(source.accuracy),
    study_minutes: toNumber(source.study_minutes),
    active_days: toNumber(source.active_days),
    daily_xp: daily.length === 7 ? daily : [...daily, 0, 0, 0, 0, 0, 0, 0].slice(0, 7),
  };
}

function normalizeRivalChallenge(value: unknown): RivalChallengeState | null {
  if (!isRecord(value)) return null;
  const week = isRecord(value.week) ? value.week : {};
  const battle = isRecord(value.battle) ? value.battle : {};
  const reward = isRecord(value.reward) ? value.reward : {};
  const lastWeek = isRecord(value.last_week) ? value.last_week : null;
  const rivalSource = isRecord(value.rival) ? value.rival : null;
  const status = String(battle.status || "unmatched");

  return {
    weekEndUtc: String(week.end_utc || ""),
    secondsRemaining: toNumber(week.seconds_remaining),
    fetchedAt: Date.now(),
    me: normalizeWeekSide(value.me),
    rival: rivalSource
      ? {
          ...normalizeWeekSide(rivalSource),
          activity: (Array.isArray(rivalSource.activity) ? rivalSource.activity : [])
            .filter(isRecord)
            .map((item) => ({
              type: String(item.type || "Study practice"),
              topic: String(item.topic || ""),
              xp_earned: toNumber(item.xp_earned),
              completed_at: String(item.completed_at || ""),
            })),
        }
      : null,
    battleStatus:
      status === "leading" || status === "trailing" || status === "tied" ? status : "unmatched",
    myWeekXp: toNumber(battle.my_week_xp),
    rivalWeekXp: toNumber(battle.rival_week_xp),
    xpGap: toNumber(battle.xp_gap),
    missions: (Array.isArray(value.missions) ? value.missions : [])
      .filter(isRecord)
      .map((item) => ({
        id: String(item.id || "mission"),
        title: String(item.title || ""),
        detail: String(item.detail || ""),
        target: Math.max(1, toNumber(item.target, 1)),
        progress: Math.max(0, toNumber(item.progress)),
        completed: Boolean(item.completed),
      })),
    rewardWinXp: toNumber(reward.win_xp, 150),
    rewardBadge: String(reward.badge || "Weekly Champion"),
    lastWeek:
      lastWeek && String(lastWeek.outcome || "")
        ? {
            outcome: String(lastWeek.outcome),
            reward_xp: toNumber(lastWeek.reward_xp),
            rival_name: String(lastWeek.rival_name || "your rival"),
          }
        : null,
  };
}

function getLeaderboardRows(value: unknown) {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  if (Array.isArray(value.leaderboard)) return value.leaderboard;
  if (Array.isArray(value.rankings)) return value.rankings;
  if (Array.isArray(value.users)) return value.users;
  return [];
}

function normalizeLeaderboard(value: unknown): LeaderboardEntry[] {
  return getLeaderboardRows(value)
    .map((item, index): LeaderboardEntry | null => {
      if (!isRecord(item)) return null;
      const userId = String(item.user_id ?? item.uid ?? item.id ?? item.terminal_id ?? "");
      if (!userId) return null;
      return {
        rank: toNumber(item.rank, index + 1),
        class_rank: item.class_rank ? toNumber(item.class_rank) : null,
        user_id: userId,
        display_name: item.display_name ? String(item.display_name) : undefined,
        name: item.name ? String(item.name) : undefined,
        class_level: item.class_level ? String(item.class_level) : undefined,
        xp: toNumber(item.xp ?? item.total_xp),
        streak: toNumber(item.streak),
      };
    })
    .filter((entry): entry is LeaderboardEntry => entry !== null);
}

function normalizeSessions(value: unknown): SessionRecord[] {
  const list = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.sessions)
      ? value.sessions
      : [];

  return list
    .map((item, index): SessionRecord | null => {
      if (!isRecord(item)) return null;
      return {
        id: String(item.id ?? item.session_id ?? `${item.topic || "session"}-${index}`),
        subject: String(item.subject || "Study"),
        class_level: item.class_level ? String(item.class_level) : undefined,
        topic: String(item.topic || "Learning session"),
        total_questions: Math.max(0, toNumber(item.total_questions ?? item.questions)),
        score: Math.max(0, toNumber(item.score ?? item.correct)),
        xp_earned: Math.max(0, toNumber(item.xp_earned ?? item.xp)),
        time_spent_seconds: Math.max(0, toNumber(item.time_spent_seconds ?? item.duration_seconds)),
        session_type: String(item.session_type || item.type || "study"),
        completed_at: String(item.completed_at ?? item.completedAt ?? item.timestamp ?? item.date ?? item.createdAt ?? ""),
      };
    })
    .filter((session): session is SessionRecord => session !== null)
    .sort((left, right) => {
      const leftTime = new Date(left.completed_at).getTime();
      const rightTime = new Date(right.completed_at).getTime();
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });
}

function buildLeaderboard({
  source,
  currentUserId,
  currentDisplayName,
  currentClassLevel,
  progress,
}: {
  source: unknown;
  currentUserId: string;
  currentDisplayName: string;
  currentClassLevel: string;
  progress: ProgressState;
}) {
  const entries = new Map<string, LeaderboardEntry>();

  for (const entry of normalizeLeaderboard(source)) {
    entries.set(entry.user_id, entry);
  }

  const current = entries.get(currentUserId);
  entries.set(currentUserId, {
    rank: current?.rank ?? entries.size + 1,
    user_id: currentUserId,
    display_name: currentDisplayName,
    name: current?.name,
    class_level: currentClassLevel || current?.class_level,
    class_rank: current?.class_rank,
    xp: Math.max(current?.xp ?? 0, progress.xp),
    streak: Math.max(current?.streak ?? 0, progress.streak),
  });

  return [...entries.values()]
    .sort((a, b) => b.xp - a.xp || b.streak - a.streak)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function accuracy(progress: ProgressState) {
  if (!progress.total_questions) return 0;
  return Math.round((progress.total_correct / progress.total_questions) * 100);
}

function getInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AI"
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function getLevelLabel(level: number) {
  if (level >= 10) return "Master";
  if (level >= 7) return "Advanced";
  if (level >= 4) return "Intermediate";
  return "Beginner";
}

function getStudentName(entry: LeaderboardEntry, currentUserId: string, currentDisplayName: string) {
  if (entry.user_id === currentUserId) return currentDisplayName;
  return entry.display_name || entry.name || `Student ${entry.rank}`;
}

function getSessionAccuracy(session: SessionRecord) {
  if (!session.total_questions) return 0;
  return Math.round((session.score / session.total_questions) * 100);
}

function getSessionLabel(session: SessionRecord) {
  const type = session.session_type.toLowerCase();
  if (type.includes("exam")) return "Exam Mode";
  if (type.includes("mission")) return "Autonomous Mission";
  return "Study practice";
}

function getSessionDestination(session: SessionRecord) {
  const topic = encodeURIComponent(session.topic);
  const type = session.session_type.toLowerCase();
  if (type.includes("exam")) return `/dashboard/exam?topic=${topic}`;
  if (type.includes("mission")) return `/dashboard/mission?topic=${topic}`;
  return `/dashboard/study?topic=${topic}`;
}

function formatSessionDate(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  const secs = Math.floor(seconds % 60);
  return `${hours}h ${minutes}m ${String(secs).padStart(2, "0")}s`;
}

function formatActivityTime(value: string) {
  const time = new Date(value).getTime();
  if (!value || !Number.isFinite(time)) return "This week";
  const minutes = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const BATTLE_COPY: Record<RivalChallengeState["battleStatus"], { label: string; message: string }> = {
  leading: { label: "You are winning", message: "Keep your lead — every session counts double for morale." },
  trailing: { label: "Rival ahead", message: "One strong session can flip this battle." },
  tied: { label: "Dead heat", message: "Perfectly tied. The next session takes the lead." },
  unmatched: { label: "Open week", message: "No rival this week — race your own record instead." },
};

function RivalBattleCard({
  challenge,
  displayName,
  secondsLeft,
}: {
  challenge: RivalChallengeState;
  displayName: string;
  secondsLeft: number;
}) {
  const rivalName = challenge.rival?.name || "Awaiting rival";
  const total = Math.max(1, challenge.myWeekXp + challenge.rivalWeekXp);
  const myShare = challenge.rival ? Math.round((challenge.myWeekXp / total) * 100) : 100;
  const copy = BATTLE_COPY[challenge.battleStatus];

  return (
    <article className="dashboard-final-panel dashboard-rival-battle" data-status={challenge.battleStatus}>
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
        <div className="dashboard-rival-countdown" role="timer" aria-label="Time left this week">
          <span className="dashboard-rival-live-dot" aria-hidden="true" />
          <div>
            <strong>{formatCountdown(secondsLeft)}</strong>
            <small>left this week</small>
          </div>
        </div>
      </div>

      <div className="dashboard-rival-versus" aria-label="Weekly XP comparison">
        <div className="dashboard-rival-side" data-side="me">
          <span className="dashboard-rival-avatar" aria-hidden="true">{getInitials(displayName)}</span>
          <div>
            <p>{displayName.split(" ")[0] || "You"}</p>
            <strong>{formatNumber(challenge.myWeekXp)} XP</strong>
            <small>
              {challenge.me.sessions} sessions · {challenge.me.accuracy}% acc · {challenge.me.active_days}/7 days
            </small>
          </div>
        </div>
        <div className="dashboard-rival-status-chip" data-status={challenge.battleStatus}>
          <strong>{copy.label}</strong>
          {challenge.rival && challenge.battleStatus !== "tied" ? (
            <small>by {formatNumber(challenge.xpGap)} XP</small>
          ) : null}
        </div>
        <div className="dashboard-rival-side" data-side="rival">
          <span className="dashboard-rival-avatar" aria-hidden="true">
            {challenge.rival ? getInitials(rivalName) : "?"}
          </span>
          <div>
            <p>{rivalName}</p>
            <strong>{challenge.rival ? `${formatNumber(challenge.rivalWeekXp)} XP` : "—"}</strong>
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
        <span className="dashboard-rival-basis">Rivals are matched by Monthly Exam performance and stay fixed all week.</span>
      </div>
    </article>
  );
}

function MissionBoard({ missions }: { missions: RivalMission[] }) {
  const done = missions.filter((mission) => mission.completed).length;
  return (
    <article className="dashboard-final-panel dashboard-rival-missions">
      <div className="dashboard-final-panel-header">
        <div>
          <p className="dashboard-section-kicker">Today&apos;s Missions</p>
          <h2>What to complete today</h2>
          <p>Missions track your real activity and complete themselves.</p>
        </div>
        <div className="dashboard-final-panel-actions">
          <span>
            {done}/{missions.length} done
          </span>
        </div>
      </div>
      <ol className="dashboard-rival-mission-list">
        {missions.map((mission) => {
          const percent = Math.round(Math.min(1, mission.progress / mission.target) * 100);
          return (
            <li key={mission.id} data-completed={mission.completed ? "true" : "false"}>
              <span className="dashboard-rival-mission-check" aria-hidden="true">
                {mission.completed ? (
                  <svg viewBox="0 0 20 20" fill="none">
                    <path d="m5 10.5 3.2 3.2L15 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              <div className="dashboard-rival-mission-main">
                <p>{mission.title}</p>
                <small>{mission.detail}</small>
                <div className="dashboard-rival-mission-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(mission.completed ? 100 : 3, percent)}%` }} />
                </div>
              </div>
              <span className="dashboard-rival-mission-state">
                {mission.completed ? "Done" : `${percent}%`}
              </span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function RivalActivityPanel({ challenge }: { challenge: RivalChallengeState }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const peak = Math.max(1, ...challenge.me.daily_xp, ...(challenge.rival?.daily_xp ?? [0]));

  return (
    <article className="dashboard-final-panel dashboard-rival-activity">
      <div className="dashboard-final-panel-header">
        <div>
          <p className="dashboard-section-kicker">Battle Pulse</p>
          <h2>This week, day by day</h2>
          <p>{challenge.rival ? "Your XP against your rival's, updating live." : "Your XP this week, day by day."}</p>
        </div>
      </div>
      <div className="dashboard-rival-week-chart" aria-label="Daily XP this week">
        {days.map((day, index) => (
          <div className="dashboard-rival-week-day" key={day}>
            <div className="dashboard-rival-week-bars">
              <span
                data-series="me"
                style={{ height: `${Math.max(4, Math.round(((challenge.me.daily_xp[index] || 0) / peak) * 100))}%` }}
                title={`You: ${challenge.me.daily_xp[index] || 0} XP`}
              />
              {challenge.rival ? (
                <span
                  data-series="rival"
                  style={{ height: `${Math.max(4, Math.round(((challenge.rival.daily_xp[index] || 0) / peak) * 100))}%` }}
                  title={`${challenge.rival.name}: ${challenge.rival.daily_xp[index] || 0} XP`}
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

function LastWeekBanner({ lastWeek, badge }: { lastWeek: NonNullable<RivalChallengeState["lastWeek"]>; badge: string }) {
  const tone = lastWeek.outcome === "won" ? "won" : lastWeek.outcome === "tied" ? "tied" : "lost";
  const headline =
    tone === "won"
      ? `You beat ${lastWeek.rival_name} last week — +${lastWeek.reward_xp} XP · ${badge}`
      : tone === "tied"
        ? `Last week ended level with ${lastWeek.rival_name} — +${lastWeek.reward_xp} XP each`
        : `${lastWeek.rival_name} took last week. New week, clean slate.`;
  return (
    <div className="dashboard-rival-lastweek" data-tone={tone} role="status">
      <AppIcon name={tone === "won" ? "spark" : "history"} />
      <p>{headline}</p>
    </div>
  );
}

type HubIconName = "dashboard" | "study" | "mission" | "exam";

function HubIcon({ name }: { name: HubIconName }) {
  if (name === "dashboard") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h4A1.5 1.5 0 0 1 11 5.5v4A1.5 1.5 0 0 1 9.5 11h-4A1.5 1.5 0 0 1 4 9.5v-4Z" />
        <path d="M13 5.5A1.5 1.5 0 0 1 14.5 4h4A1.5 1.5 0 0 1 20 5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 13 9.5v-4Z" />
        <path d="M4 14.5A1.5 1.5 0 0 1 5.5 13h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 9.5 20h-4A1.5 1.5 0 0 1 4 18.5v-4Z" />
        <path d="M13 14.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4Z" />
      </svg>
    );
  }

  if (name === "study") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
        <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H12l-4.5 4v-4A2.5 2.5 0 0 1 5 12.5v-6Z" />
        <path d="M8 8h8M8 11h5" />
      </svg>
    );
  }

  if (name === "mission") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
        <path d="M12 21a9 9 0 1 0-9-9" />
        <path d="M12 17a5 5 0 1 0-5-5" />
        <path d="M12 13a1 1 0 1 0-1-1" />
        <path d="M4 20 12 12M4 20h4M4 20v-4" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
      <path d="M8 3.5h8A1.5 1.5 0 0 1 17.5 5v14A1.5 1.5 0 0 1 16 20.5H8A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5Z" />
      <path d="M9 8h6M9 12h2M13 12h2M9 16h2M13 16h2" />
    </svg>
  );
}

function HubTile({
  href,
  eyebrow,
  title,
  description,
  helper,
  action,
  icon,
  tone,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  helper: string;
  action: string;
  icon: HubIconName;
  tone: "teal" | "gold" | "study" | "mission";
}) {
  const toneClass =
    tone === "gold"
      ? "from-[#FFF8E7] via-[#FFF0C8] to-[#FFE3A3] text-[#744900]"
      : tone === "mission"
        ? "from-[#ECFDF5] via-[#E5FAF3] to-[#CDEFE5] text-[#075F54]"
        : tone === "study"
          ? "from-[#F1FBFF] via-[#E7F8F6] to-[#C9F0EC] text-[#0B5363]"
          : "from-[#EAFDFC] via-[#DFF8F3] to-[#D5F0EA] text-[#0E5264]";

  return (
    <Link
      href={href}
      aria-label={`${title}: ${description}`}
      className={`hub-tile hub-tile--${tone} group relative min-h-[238px] overflow-hidden bg-gradient-to-br ${toneClass} p-6 outline-none sm:p-7`}
    >
      <div className="hub-tile-glow absolute right-[-3.5rem] top-[-3.5rem] h-36 w-36 rounded-full bg-white/28 blur-2xl transition duration-500 group-hover:scale-110" />
      <div className="hub-tile-content relative z-20 flex h-full flex-col">
        <div className="hub-tile-top flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">{eyebrow}</p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
          </div>
          <span className="hub-tile-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/50 bg-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <HubIcon name={icon} />
          </span>
        </div>

        <p className="hub-tile-description mt-4 max-w-sm text-sm leading-6 opacity-[0.78]">{description}</p>
        <div className="hub-tile-footer mt-auto pt-7">
          <div className="flex items-end justify-between gap-4">
            <span className="hub-tile-helper min-w-0 text-xs font-semibold leading-5 opacity-[0.68]">{helper}</span>
            <span className="hub-tile-action inline-flex shrink-0 items-center rounded-full border border-white/60 bg-white/48 px-4 py-2 text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              {action}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function DashboardDataAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="dashboard-final-data-alert flex w-full flex-col gap-2 px-1 pt-2 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <AlertState tone="amber" message={message} />
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="agentify-action agentify-action-secondary shrink-0 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
      >
        Retry
      </button>
    </div>
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
  const studentName = getStudentName(entry, currentUserId, currentDisplayName);
  const level = Math.floor(entry.xp / 100) + 1;
  const levelLabel = getLevelLabel(level);

  return (
    <li className="dashboard-leaderboard-row" data-current={isCurrent ? "true" : "false"}>
      <div className="dashboard-rank-cell" data-rank={entry.rank <= 3 ? entry.rank : undefined}>
        <svg
          className="dashboard-rank-medal"
          viewBox="0 0 72 72"
          fill="none"
          aria-hidden="true"
        >
          <path className="dashboard-rank-ribbon" d="m22 40-5 27 14-8 5 10 5-29H22Z" />
          <path className="dashboard-rank-ribbon" d="m50 40 5 27-14-8-5 10-5-29h19Z" />
          <circle className="dashboard-rank-medal-face" cx="36" cy="29" r="23" />
          <circle className="dashboard-rank-medal-ring" cx="36" cy="29" r="17" />
          <path className="dashboard-rank-medal-shine" d="M22.5 27.5A14.5 14.5 0 0 1 34 15" />
        </svg>
        <strong>{entry.rank}</strong>
      </div>
      <div className="dashboard-student-cell">
        <span className="dashboard-student-avatar" aria-hidden="true">
          {getInitials(studentName)}
        </span>
        <span className="min-w-0">
          <span className="dashboard-student-name">
            {studentName}
            {isCurrent ? <span className="dashboard-you-label">You</span> : null}
          </span>
          <span className="dashboard-student-note">
            {entry.class_level
              ? `${entry.class_level}${entry.class_rank ? ` - Class rank #${entry.class_rank}` : ""}`
              : isCurrent
                ? "Keep building your learning momentum."
                : `${formatNumber(entry.xp)} experience points`}
          </span>
          <span className="dashboard-student-mobile-meta">
            Level {level} - {entry.streak} day streak
          </span>
        </span>
      </div>
      <div className="dashboard-leaderboard-stat dashboard-leaderboard-level">
        <strong>{level}</strong>
        <span>{levelLabel}</span>
      </div>
      <div className="dashboard-leaderboard-stat dashboard-leaderboard-streak">
        <strong>
          <AppIcon name="clock" />
          {entry.streak} d
        </strong>
        <span>Current</span>
      </div>
      <div className="dashboard-leaderboard-xp">
        <strong>{formatNumber(entry.xp)}</strong>
        <span>XP</span>
      </div>
    </li>
  );
}

function RecentSessionRow({ session }: { session: SessionRecord }) {
  const sessionAccuracy = getSessionAccuracy(session);

  return (
    <li className="dashboard-session-row">
      <div className="dashboard-session-icon" aria-hidden="true">
        {session.session_type.toLowerCase().includes("exam") ? "E" : session.session_type.toLowerCase().includes("mission") ? "M" : "S"}
      </div>
      <div className="dashboard-session-main">
        <div>
          <span>{getSessionLabel(session)}</span>
          <h3>{session.topic.replace(/_/g, " ")}</h3>
        </div>
        <p>
          {session.subject}
          {session.class_level ? ` / ${session.class_level}` : ""}
          {" / "}
          {formatSessionDate(session.completed_at)}
        </p>
      </div>
      <div className="dashboard-session-stat">
        <strong>{sessionAccuracy}%</strong>
        <span>Accuracy</span>
      </div>
      <div className="dashboard-session-stat">
        <strong>+{session.xp_earned}</strong>
        <span>XP</span>
      </div>
      <Link href={getSessionDestination(session)} className="dashboard-session-action">
        Revise
      </Link>
    </li>
  );
}

export default function DashboardPage() {
  const { profile, userId, loading, getAuthHeaders } = useAuth();
  const searchParams = useSearchParams();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  const [progress, setProgress] = useState<ProgressState>({
    total_tests: 0,
    total_questions: 0,
    total_correct: 0,
    xp: 0,
    streak: 0,
  });
  const [leaderboardSource, setLeaderboardSource] = useState<unknown>([]);
  const [challenge, setChallenge] = useState<RivalChallengeState | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [sessionsError, setSessionsError] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const displayName = profile?.name || "Student";
  const classLevel = profile?.classLevel || "";
  const firstName = displayName.split(" ")[0] || "Student";
  const showOverview = searchParams.get("workspace") === "overview";
  const accuracyValue = accuracy(progress);
  const level = Math.floor(progress.xp / 100) + 1;
  const levelLabel = getLevelLabel(level);

  const rankedLeaderboard = useMemo(
    () =>
      buildLeaderboard({
        source: leaderboardSource,
        currentUserId: userId,
        currentDisplayName: displayName,
        currentClassLevel: classLevel,
        progress,
      }),
    [classLevel, displayName, leaderboardSource, progress, userId],
  );

  const currentRank = rankedLeaderboard.find((entry) => entry.user_id === userId);
  const studentCountLabel = `${rankedLeaderboard.length} ${rankedLeaderboard.length === 1 ? "student" : "students"}`;
  const recentSessions = sessions.slice(0, 3);

  const focusMessage = useMemo(() => {
    if (!progress.total_questions) return "Start with one short mission today.";
    if (accuracyValue < 60) return "Focus on clarity before speed.";
    if (accuracyValue < 80) return "You are close. Practice weak spots.";
    return "Strong momentum. Move to exam-style practice.";
  }, [accuracyValue, progress.total_questions]);
  useEffect(() => {
    if (loading || !userId) return;
    let active = true;

    async function loadDashboard() {
      setLoadingData(true);
      setDataError("");
      try {
        primeBackend(backendURL);
        const headers = await getAuthHeaders();
        const forceFresh = reloadToken > 0;
        const [progressJson, leaderboardJson, sessionsJson, challengeJson] = await Promise.all([
          apiJson<unknown>(`${backendURL}/get-progress/${userId}`, {
            headers,
            cacheKey: `progress:${userId}`,
            cacheTtlMs: 30000,
            forceFresh,
            retries: 1,
            timeoutMs: 7000,
          }).catch(() => null),
          apiJson<unknown>(`${backendURL}/leaderboard`, {
            headers,
            cacheKey: `leaderboard:${userId}`,
            cacheTtlMs: 10000,
            forceFresh,
            retries: 1,
            timeoutMs: 7000,
          }).catch(() => null),
          apiJson<unknown>(`${backendURL}/sessions/${userId}`, {
            headers,
            cacheKey: `sessions:${userId}`,
            cacheTtlMs: 30000,
            forceFresh,
            retries: 1,
            timeoutMs: 7000,
          }).catch(() => null),
          apiJson<unknown>(`${backendURL}/rivals/weekly-challenge/${userId}`, {
            headers,
            cacheKey: `rival-challenge:${userId}`,
            cacheTtlMs: 30000,
            forceFresh,
            retries: 1,
            timeoutMs: 9000,
          }).catch(() => null),
        ]);

        if (!active) return;
        const normalizedProgress = normalizeProgress(progressJson);
        setProgress(normalizedProgress);
        setLeaderboardSource(leaderboardJson ?? []);
        setChallenge(normalizeRivalChallenge(challengeJson));
        setSessions(normalizeSessions(sessionsJson));
        setSessionsError(sessionsJson === null ? "Recent learning could not refresh right now." : "");
        setDataError(
          progressJson === null || leaderboardJson === null
            ? "Some progress signals could not refresh. Showing your latest available results."
            : "",
        );
      } catch {
        if (!active) return;
        setDataError("Progress could not refresh. Showing a safe learning view.");
      } finally {
        if (active) setLoadingData(false);
      }
    }

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [backendURL, getAuthHeaders, loading, reloadToken, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    let active = true;

    async function refreshLiveData() {
      try {
        const headers = await getAuthHeaders();
        const [leaderboardJson, challengeJson] = await Promise.all([
          apiJson<unknown>(`${backendURL}/leaderboard`, {
            headers,
            cacheKey: `leaderboard:${userId}`,
            cacheTtlMs: 0,
            forceFresh: true,
            retries: 1,
            timeoutMs: 7000,
          }),
          apiJson<unknown>(`${backendURL}/rivals/weekly-challenge/${userId}`, {
            headers,
            cacheKey: `rival-challenge:${userId}`,
            cacheTtlMs: 0,
            forceFresh: true,
            retries: 1,
            timeoutMs: 9000,
          }).catch(() => null),
        ]);
        if (!active) return;
        setLeaderboardSource(leaderboardJson);
        const normalizedChallenge = normalizeRivalChallenge(challengeJson);
        if (normalizedChallenge) setChallenge(normalizedChallenge);
      } catch {
        // Keep the latest complete ranking visible during a transient refresh failure.
      }
    }

    const timer = window.setInterval(() => {
      void refreshLiveData();
    }, 20000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [backendURL, getAuthHeaders, loading, userId]);

  // The countdown ticks locally between server refreshes so the week clock
  // always moves, even offline.
  useEffect(() => {
    if (!challenge) return;
    const compute = () =>
      Math.max(0, challenge.secondsRemaining - Math.floor((Date.now() - challenge.fetchedAt) / 1000));
    setSecondsLeft(compute());
    const timer = window.setInterval(() => setSecondsLeft(compute()), 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  const retryDashboard = () => {
    invalidateApiCache(`progress:${userId}`);
    invalidateApiCache(`leaderboard:${userId}`);
    invalidateApiCache(`sessions:${userId}`);
    invalidateApiCache(`rival-challenge:${userId}`);
    setReloadToken((current) => current + 1);
  };

  if (loading) {
    return <LoadingState title="Preparing dashboard…" detail="Loading your learning hub and progress." />;
  }

  if (!showOverview) {
    return (
      <div className="w-full">
        {dataError ? <DashboardDataAlert message={dataError} onRetry={retryDashboard} /> : null}
        <section className="flex min-h-[calc(100svh-118px)] flex-col items-center justify-center gap-7 py-8">
          <div className="max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#0E7490]">
              Learning Hub{classLevel ? ` / ${classLevel}` : ""}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
              Good to see you, {firstName}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-500">
              Pick one section from the hub. Each card opens a focused learning space built around one clear student task.
            </p>
          </div>

          <div className="relative w-full max-w-[1180px] px-1 sm:px-4">
            <div
              aria-label="AgentifyAI learning spaces"
              className="hub-grid grid grid-cols-1 overflow-visible rounded-[3rem] border border-white/70 bg-white/60 shadow-[0_36px_120px_rgba(15,23,42,0.14)] backdrop-blur-2xl md:grid-cols-2"
            >
              <HubTile
                href="/dashboard?workspace=overview"
                eyebrow="Overview"
                title="Dashboard"
                description="See your level, accuracy, streak, XP, and current student rank."
                helper="Your essential progress view"
                action="View progress"
                icon="dashboard"
                tone="teal"
              />
              <HubTile
                href="/dashboard/study"
                eyebrow="Ask"
                title="Study Page"
                description="Ask doubts, get examples, create revision notes, and build focused recall tools."
                helper="Best when you are stuck"
                action="Ask a doubt"
                icon="study"
                tone="study"
              />
              <HubTile
                href="/dashboard/mission"
                eyebrow="Improve"
                title="Autonomous Mission"
                description="Choose a chapter and let AgentifyAI plan, quiz, explain, and guide your next move."
                helper="Best for guided study"
                action="Start mission"
                icon="mission"
                tone="mission"
              />
              <HubTile
                href="/dashboard/exam"
                eyebrow="Test"
                title="Exam Mode"
                description="Generate grounded MCQs and probable questions, submit once, and review every mistake."
                helper="Best for focused exam preparation"
                action="Start exam"
                icon="exam"
                tone="gold"
              />
            </div>
          </div>

          <div className="w-full max-w-3xl rounded-[1.7rem] border border-white/70 bg-white/70 p-5 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Today&apos;s focus</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{focusMessage}</p>
            <div className="mx-auto mt-5 h-2 max-w-xl rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#0E7490,#14B8A6,#F2B84B)] transition-[width]"
                style={{ width: `${Math.max(6, Math.min(100, accuracyValue || 6))}%` }}
              />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard-overview dashboard-final-overview mx-auto w-full" aria-busy={loadingData}>
      {dataError ? <DashboardDataAlert message={dataError} onRetry={retryDashboard} /> : null}

      <header className="dashboard-final-hero">
        <div className="dashboard-final-hero-copy">
          <nav aria-label="Breadcrumb" className="dashboard-breadcrumb">
            <Link href="/dashboard">Learning Hub</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Dashboard</span>
          </nav>
          {classLevel ? <p className="dashboard-section-kicker">{classLevel} learning profile</p> : null}
          <h1>
            Student <span>Progress</span>
          </h1>
          <p>Your essential learning signals and student rank, all in one focused view.</p>
        </div>
        <div
          className="dashboard-final-hero-rank"
          aria-label={`Your rank is ${currentRank?.rank ?? 1} of ${rankedLeaderboard.length}`}
        >
          <span>Your Rank</span>
          <strong>#{currentRank?.rank ?? 1}</strong>
          <small>of {studentCountLabel}</small>
          <div className="dashboard-final-rank-lines" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
      </header>

      <section className="dashboard-rival-section" aria-label="Weekly Rival Challenge" aria-live="polite">
        {challenge?.lastWeek ? (
          <LastWeekBanner lastWeek={challenge.lastWeek} badge={challenge.rewardBadge} />
        ) : null}

        {challenge ? (
          <>
            <RivalBattleCard challenge={challenge} displayName={displayName} secondsLeft={secondsLeft} />
            <div className="dashboard-rival-columns">
              <MissionBoard missions={challenge.missions} />
              <RivalActivityPanel challenge={challenge} />
            </div>
          </>
        ) : (
          <article className="dashboard-final-panel dashboard-rival-battle" data-status="unmatched">
            <div className="dashboard-rival-battle-top">
              <div>
                <p className="dashboard-section-kicker">Weekly Rival Challenge</p>
                <h2>{loadingData ? "Finding your rival…" : "Rival battle unavailable right now"}</h2>
                <p className="dashboard-rival-battle-message">
                  {loadingData
                    ? "Matching you with a student at your level from this month's exam rankings."
                    : "The challenge could not refresh. Your battle continues — retry above."}
                </p>
              </div>
            </div>
          </article>
        )}

        <div className="dashboard-rival-season" aria-label="Season totals">
          <span>
            <small>Level</small>
            <strong>
              {level} · {levelLabel}
            </strong>
          </span>
          <span>
            <small>Accuracy</small>
            <strong>{accuracyValue}%</strong>
          </span>
          <span>
            <small>Streak</small>
            <strong>{progress.streak} d</strong>
          </span>
          <span>
            <small>Total XP</small>
            <strong>{formatNumber(progress.xp)}</strong>
          </span>
        </div>
      </section>

      <section className="dashboard-final-panel dashboard-final-recent" aria-labelledby="recent-learning-title">
        <div className="dashboard-final-panel-header">
          <div>
            <p className="dashboard-section-kicker">Recent Learning</p>
            <h2 id="recent-learning-title">Continue from your latest work</h2>
            <p>Only your three newest attempts are shown, with a direct route back to practice.</p>
          </div>
          <div className="dashboard-final-panel-actions">
            <span>{recentSessions.length} recent</span>
            <button type="button" onClick={retryDashboard} disabled={loadingData}>
              <AppIcon name="history" />
              {loadingData ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>

        {sessionsError ? <div className="dashboard-recent-notice">{sessionsError}</div> : null}

        {recentSessions.length ? (
          <ol className="dashboard-session-list">
            {recentSessions.map((session) => <RecentSessionRow key={session.id} session={session} />)}
          </ol>
        ) : (
          <div className="dashboard-session-empty dashboard-final-session-empty">
            <span className="dashboard-final-empty-icon" aria-hidden="true">
              <AppIcon name="history" />
            </span>
            <div>
              <h3>No completed attempts yet</h3>
              <p>Your latest Exam Mode and Autonomous Mission results will appear here automatically.</p>
            </div>
            <div>
              <Link href="/dashboard/exam">Start Exam Mode</Link>
              <Link href="/dashboard/mission">Start a mission</Link>
            </div>
          </div>
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
            <p>Ranked by total XP. Streak breaks ties between students with equal XP.</p>
          </div>
          <div className="dashboard-final-panel-actions">
            <span>All time</span>
            <div className="dashboard-leaderboard-count">
              <span aria-hidden="true" />
              {studentCountLabel}
            </div>
          </div>
        </div>

        <div className="dashboard-leaderboard-columns" aria-hidden="true">
          <span>Rank</span>
          <span>Student</span>
          <span>Level</span>
          <span>Streak</span>
          <span>XP</span>
        </div>

        <ol className="dashboard-leaderboard-list">
          {rankedLeaderboard.map((entry) => (
            <LeaderboardRow
              key={entry.user_id}
              entry={entry}
              currentUserId={userId}
              currentDisplayName={displayName}
            />
          ))}
        </ol>
      </section>
    </div>
  );
}
