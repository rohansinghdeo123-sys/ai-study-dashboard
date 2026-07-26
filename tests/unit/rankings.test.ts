import { describe, expect, it } from "vitest";
import { normalizeLeaderboard } from "@/features/rankings/leaderboard";
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
});
