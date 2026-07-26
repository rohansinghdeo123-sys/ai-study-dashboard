export type RivalWeekSide = {
  name: string;
  class_level?: string;
  week_xp: number;
  sessions: number;
  accuracy: number;
  study_minutes: number;
  active_days: number;
  daily_xp: number[];
};

export type RivalActivityItem = {
  type: string;
  topic: string;
  xp_earned: number;
  completed_at: string;
};

export type RivalMission = {
  id: string;
  title: string;
  detail: string;
  target: number;
  progress: number;
  completed: boolean;
};

export type RivalChallenge = {
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
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeWeekSide(value: unknown): RivalWeekSide {
  const source = isRecord(value) ? value : {};
  const dailyXp = Array.isArray(source.daily_xp)
    ? source.daily_xp.map((item) => Math.max(0, toNumber(item)))
    : [];

  return {
    name: String(source.name || "Student"),
    class_level: source.class_level ? String(source.class_level) : undefined,
    week_xp: Math.max(0, toNumber(source.week_xp)),
    sessions: Math.max(0, toNumber(source.sessions)),
    accuracy: Math.max(0, Math.min(100, toNumber(source.accuracy))),
    study_minutes: Math.max(0, toNumber(source.study_minutes)),
    active_days: Math.max(0, Math.min(7, toNumber(source.active_days))),
    daily_xp: [...dailyXp, 0, 0, 0, 0, 0, 0, 0].slice(0, 7),
  };
}

export function normalizeRivalChallenge(
  value: unknown,
  fetchedAt = Date.now(),
): RivalChallenge | null {
  if (!isRecord(value)) return null;

  const week = isRecord(value.week) ? value.week : {};
  const battle = isRecord(value.battle) ? value.battle : {};
  const reward = isRecord(value.reward) ? value.reward : {};
  const lastWeek = isRecord(value.last_week) ? value.last_week : null;
  const rivalSource = isRecord(value.rival) ? value.rival : null;
  const rawStatus = String(battle.status || "unmatched");
  const battleStatus =
    rawStatus === "leading" || rawStatus === "trailing" || rawStatus === "tied"
      ? rawStatus
      : "unmatched";

  return {
    weekEndUtc: String(week.end_utc || ""),
    secondsRemaining: Math.max(0, toNumber(week.seconds_remaining)),
    fetchedAt,
    me: normalizeWeekSide(value.me),
    rival: rivalSource
      ? {
          ...normalizeWeekSide(rivalSource),
          activity: (Array.isArray(rivalSource.activity)
            ? rivalSource.activity
            : []
          )
            .filter(isRecord)
            .map((item) => ({
              type: String(item.type || "Study practice"),
              topic: String(item.topic || ""),
              xp_earned: Math.max(0, toNumber(item.xp_earned)),
              completed_at: String(item.completed_at || ""),
            })),
        }
      : null,
    battleStatus,
    myWeekXp: Math.max(0, toNumber(battle.my_week_xp)),
    rivalWeekXp: Math.max(0, toNumber(battle.rival_week_xp)),
    xpGap: Math.max(0, toNumber(battle.xp_gap)),
    missions: (Array.isArray(value.missions) ? value.missions : [])
      .filter(isRecord)
      .map((item) => ({
        id: String(item.id || "mission"),
        title: String(item.title || "Mission"),
        detail: String(item.detail || ""),
        target: Math.max(1, toNumber(item.target, 1)),
        progress: Math.max(0, toNumber(item.progress)),
        completed: Boolean(item.completed),
      })),
    rewardWinXp: Math.max(0, toNumber(reward.win_xp, 150)),
    rewardBadge: String(reward.badge || "Weekly Champion"),
    lastWeek:
      lastWeek && String(lastWeek.outcome || "")
        ? {
            outcome: String(lastWeek.outcome),
            reward_xp: Math.max(0, toNumber(lastWeek.reward_xp)),
            rival_name: String(lastWeek.rival_name || "your rival"),
          }
        : null,
  };
}

export function remainingChallengeSeconds(
  challenge: RivalChallenge,
  now = Date.now(),
) {
  return Math.max(
    0,
    challenge.secondsRemaining - Math.floor((now - challenge.fetchedAt) / 1000),
  );
}
