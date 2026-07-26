import { describe, expect, it } from "vitest";
import {
  createRankChase,
  leagueDivisionForXp,
  normalizeLeaderboard,
} from "@/features/rankings/leaderboard";
import {
  normalizeRivalChallenge,
  remainingChallengeSeconds,
} from "@/features/rankings/rival";

describe("rankings contracts", () => {
  it("accepts legacy leaderboard containers, identifiers, and total XP", () => {
    const result = normalizeLeaderboard({
      rankings: [
        {
          terminal_id: "legacy-student",
          rank: 2,
          name: "Legacy Learner",
          total_xp: "340",
          streak: "4",
          total_tests: "8",
        },
        {
          uid: "top-student",
          rank: 1,
          display_name: "Top Learner",
          xp: 500,
          class_rank: 1,
        },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.user_id)).toEqual([
      "top-student",
      "legacy-student",
    ]);
    expect(result[1]).toEqual(
      expect.objectContaining({
        xp: 340,
        streak: 4,
        total_tests: 8,
      }),
    );
  });

  it("normalizes the complete weekly rival payload", () => {
    const challenge = normalizeRivalChallenge(
      {
        week: { end_utc: "2026-07-27T00:00:00Z", seconds_remaining: 3600 },
        me: {
          name: "Rohan",
          week_xp: 420,
          sessions: 5,
          accuracy: 82,
          study_minutes: 95,
          active_days: 4,
          daily_xp: [20, 40, 60],
        },
        rival: {
          name: "Amit",
          week_xp: 390,
          sessions: 4,
          accuracy: 78,
          study_minutes: 80,
          active_days: 3,
          daily_xp: [30, 50, 70, 80, 90, 40, 30],
          activity: [
            {
              type: "Exam Mode",
              topic: "Hydrocarbons",
              xp_earned: 80,
              completed_at: "2026-07-26T08:00:00Z",
            },
          ],
        },
        battle: {
          status: "leading",
          my_week_xp: 420,
          rival_week_xp: 390,
          xp_gap: 30,
        },
        missions: [
          {
            id: "study",
            title: "Complete one study loop",
            detail: "Finish a tracked Study Lab session",
            target: 1,
            progress: 1,
            completed: true,
          },
        ],
        reward: { win_xp: 150, badge: "Weekly Champion" },
        last_week: { outcome: "won", reward_xp: 150, rival_name: "Sam" },
      },
      1_000,
    );

    expect(challenge).not.toBeNull();
    expect(challenge?.battleStatus).toBe("leading");
    expect(challenge?.rival?.name).toBe("Amit");
    expect(challenge?.rival?.activity[0]?.topic).toBe("Hydrocarbons");
    expect(challenge?.missions[0]?.completed).toBe(true);
    expect(challenge?.me.daily_xp).toHaveLength(7);
    expect(challenge?.me.daily_xp.slice(0, 4)).toEqual([20, 40, 60, 0]);
    expect(challenge?.lastWeek?.outcome).toBe("won");
    expect(challenge && remainingChallengeSeconds(challenge, 31_000)).toBe(3570);
  });

  it("keeps unavailable and unmatched rival states safe", () => {
    expect(normalizeRivalChallenge(null)).toBeNull();
    expect(normalizeRivalChallenge({})).toBeNull();

    const challenge = normalizeRivalChallenge({
      week: { seconds_remaining: -10 },
      me: {},
      battle: { status: "unexpected" },
      rival: null,
    });

    expect(challenge?.battleStatus).toBe("unmatched");
    expect(challenge?.rival).toBeNull();
    expect(challenge?.secondsRemaining).toBe(0);
    expect(challenge?.rewardWinXp).toBe(150);
  });

  it("derives rival scores, status, and gap from week totals when battle duplicates are absent", () => {
    const challenge = normalizeRivalChallenge({
      week: { seconds_remaining: 60 },
      me: { name: "Rohan", week_xp: 90 },
      rival: { name: "Amit", week_xp: 120 },
      battle: {},
    });

    expect(challenge).toEqual(
      expect.objectContaining({
        battleStatus: "trailing",
        myWeekXp: 90,
        rivalWeekXp: 120,
        xpGap: 30,
      }),
    );
  });

  it("derives learning divisions and the nearest truthful rank chase", () => {
    const entries = normalizeLeaderboard([
      { user_id: "leader", rank: 1, xp: 1500, streak: 8, total_tests: 12 },
      { user_id: "me", rank: 2, xp: 1180, streak: 5, total_tests: 9 },
      { user_id: "third", rank: 3, xp: 900, streak: 3, total_tests: 7 },
    ]);

    expect([
      leagueDivisionForXp(0).shortLabel,
      leagueDivisionForXp(300).shortLabel,
      leagueDivisionForXp(600).shortLabel,
      leagueDivisionForXp(900).shortLabel,
      leagueDivisionForXp(1400).shortLabel,
    ]).toEqual(["Explorer", "Scholar", "Strategist", "Vanguard", "Luminary"]);
    expect(createRankChase(entries, "me")).toEqual(
      expect.objectContaining({
        mode: "chasing",
        opponent: expect.objectContaining({ user_id: "leader" }),
        xpGap: 321,
        targetXp: 1501,
      }),
    );
  });

  it("turns the top learner's closest rival into a lead-defense chase", () => {
    const entries = normalizeLeaderboard([
      { user_id: "me", rank: 1, xp: 800, streak: 6, total_tests: 10 },
      { user_id: "second", rank: 2, xp: 725, streak: 4, total_tests: 8 },
    ]);

    expect(createRankChase(entries, "me")).toEqual(
      expect.objectContaining({
        mode: "defending",
        opponent: expect.objectContaining({ user_id: "second" }),
        xpGap: 75,
      }),
    );
  });

  it("does not invent a chase when the current learner or an opponent is missing", () => {
    const solo = normalizeLeaderboard([
      { user_id: "solo", rank: 1, xp: 300, streak: 2, total_tests: 4 },
    ]);

    expect(createRankChase(solo, "solo")).toBeNull();
    expect(createRankChase(solo, "missing")).toBeNull();
  });
});
