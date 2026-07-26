export type LeaderboardEntry = {
  rank: number;
  class_rank?: number | null;
  user_id: string;
  name?: string;
  display_name?: string;
  class_level?: string;
  xp: number;
  streak: number;
  total_tests: number;
};

export type LeagueDivision = {
  key: "explorer" | "scholar" | "strategist" | "vanguard" | "luminary";
  label: string;
  shortLabel: string;
};

export type RankChase = {
  me: LeaderboardEntry;
  opponent: LeaderboardEntry;
  mode: "chasing" | "defending";
  xpGap: number;
  targetXp: number;
  progress: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rowsFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.leaderboard)) return payload.leaderboard;
  if (Array.isArray(payload.rankings)) return payload.rankings;
  if (Array.isArray(payload.users)) return payload.users;
  return [];
}

export function normalizeLeaderboard(payload: unknown): LeaderboardEntry[] {
  const unique = new Map<string, LeaderboardEntry>();

  rowsFromPayload(payload).forEach((row, index) => {
    if (!isRecord(row)) return;
    const userId = String(
      row.user_id ?? row.uid ?? row.id ?? row.terminal_id ?? "",
    ).trim();
    if (!userId) return;

    const existing = unique.get(userId);
    unique.set(userId, {
      rank: Math.max(1, toNumber(row.rank, existing?.rank ?? index + 1)),
      class_rank:
        row.class_rank === null || row.class_rank === undefined
          ? existing?.class_rank ?? null
          : Math.max(1, toNumber(row.class_rank, 1)),
      user_id: userId,
      name: row.name ? String(row.name) : existing?.name,
      display_name: row.display_name
        ? String(row.display_name)
        : existing?.display_name,
      class_level: row.class_level
        ? String(row.class_level).trim()
        : existing?.class_level,
      xp: Math.max(0, toNumber(row.xp ?? row.total_xp, existing?.xp ?? 0)),
      streak: Math.max(0, toNumber(row.streak, existing?.streak ?? 0)),
      total_tests: Math.max(
        0,
        toNumber(row.total_tests, existing?.total_tests ?? 0),
      ),
    });
  });

  return [...unique.values()].sort(
    (left, right) =>
      left.rank - right.rank ||
      right.xp - left.xp ||
      left.user_id.localeCompare(right.user_id),
  );
}

export function leaderboardDisplayName(
  entry: LeaderboardEntry,
  currentUserId: string,
  currentDisplayName: string,
) {
  if (entry.user_id === currentUserId && currentDisplayName.trim()) {
    return currentDisplayName.trim();
  }
  return entry.display_name?.trim() || entry.name?.trim() || "Agentify learner";
}

export function learnerInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "AI";
}

export function formatRankNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(Math.max(0, value));
}

export function leagueDivisionForXp(xp: number): LeagueDivision {
  const level = Math.floor(Math.max(0, xp) / 100) + 1;

  if (level >= 15) {
    return { key: "luminary", label: "Luminary Division", shortLabel: "Luminary" };
  }
  if (level >= 10) {
    return { key: "vanguard", label: "Vanguard Division", shortLabel: "Vanguard" };
  }
  if (level >= 7) {
    return { key: "strategist", label: "Strategist Division", shortLabel: "Strategist" };
  }
  if (level >= 4) {
    return { key: "scholar", label: "Scholar Division", shortLabel: "Scholar" };
  }
  return { key: "explorer", label: "Explorer Division", shortLabel: "Explorer" };
}

export function createRankChase(
  entries: LeaderboardEntry[],
  currentUserId: string,
): RankChase | null {
  const me = entries.find((entry) => entry.user_id === currentUserId);
  if (!me) return null;

  const opponent = me.rank > 1
    ? [...entries]
        .filter((entry) => entry.rank < me.rank)
        .sort((left, right) => right.rank - left.rank)[0]
    : [...entries]
        .filter((entry) => entry.user_id !== currentUserId)
        .sort((left, right) => left.rank - right.rank)[0];

  if (!opponent) return null;

  const mode = me.rank === 1 ? "defending" : "chasing";
  const targetXp = mode === "chasing" ? opponent.xp + 1 : me.xp;
  const xpGap = mode === "chasing"
    ? Math.max(1, targetXp - me.xp)
    : Math.max(0, me.xp - opponent.xp);
  const progress = mode === "chasing"
    ? Math.round((me.xp / Math.max(1, targetXp)) * 100)
    : Math.round((me.xp / Math.max(1, me.xp + opponent.xp)) * 100);

  return {
    me,
    opponent,
    mode,
    xpGap,
    targetXp,
    progress: Math.max(0, Math.min(100, progress)),
  };
}
