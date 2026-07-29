import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getPlanningTimeFit,
  type AutonomousMission,
  type PlanningPlan,
  type PlanningScope,
} from "@/features/planning/contracts";
import {
  getPlanBlockDestination,
  getPlanningHandoffs,
  PLANNING_ROUTES,
} from "@/features/planning/routes";

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const mission: AutonomousMission = {
  mission_id: "mission_test",
  status: "ready",
  subject: "Chemistry",
  chapter: "matter",
  target_topic: "atomic_mass",
  target_source: "selected_topic",
  objective: "Understand atomic mass",
  why: "It is the selected topic.",
  steps: [],
  next_actions: [],
  study_plan: [
    { title: "Core idea", duration: "20 min", detail: "Learn the central model." },
    { title: "Application sprint", duration: "15 min", detail: "Answer standard questions." },
  ],
};

const scope: PlanningScope = {
  chapter: "matter",
  chapterLabel: "Basic Concepts of Chemistry",
  topic: "atomic_mass",
  topicLabel: "Atomic Mass",
  subject: "Chemistry",
  classLevel: "Class 11",
};

function plan(requestedMinutes: number): PlanningPlan {
  return {
    mission,
    scope,
    profile: {
      currentKnowledge: "some_idea",
      learningGoal: "exam",
      availableMinutes: String(requestedMinutes),
      examTarget: "school_exam",
      preferredStyle: "examples_first",
      prerequisiteConfidence: "medium",
    },
    catalogSource: "published",
    requestedMinutes,
    createdAt: "2026-07-29T10:00:00.000Z",
  };
}

describe("market-ready Planning routes", () => {
  it("exposes one focused route per planning job", () => {
    expect(PLANNING_ROUTES).toEqual({
      home: "/dashboard/planning",
      new: "/dashboard/planning/new",
      active: "/dashboard/planning/active",
      checkpoint: "/dashboard/planning/checkpoint",
      review: "/dashboard/planning/review",
      history: "/dashboard/planning/history",
    });

    Object.values(PLANNING_ROUTES).slice(1).forEach((route) => {
      const leaf = route.split("/").at(-1);
      expect(readSource(`app/dashboard/planning/${leaf}/page.tsx`)).toBeTruthy();
    });
  });

  it("states time fit from returned block totals without pseudo readiness", () => {
    expect(getPlanningTimeFit(plan(45))).toMatchObject({
      requested: 45,
      planned: 35,
      difference: 10,
      state: "fits",
      label: "Fits your study window",
    });
    expect(getPlanningTimeFit(plan(20))).toMatchObject({
      requested: 20,
      planned: 35,
      difference: 15,
      state: "over",
      label: "Needs more time",
    });
  });

  it("makes route blocks executable and carries plan context", () => {
    const study = getPlanBlockDestination(
      { title: "Core idea", detail: "Learn the concept." },
      0,
      scope,
      mission.mission_id,
    );
    const revision = getPlanBlockDestination(
      { title: "Recall revision", detail: "Recall key relationships." },
      1,
      scope,
      mission.mission_id,
    );
    const exam = getPlanBlockDestination(
      { title: "Application sprint", detail: "Practice questions." },
      2,
      scope,
      mission.mission_id,
    );
    const checkpoint = getPlanBlockDestination(
      { title: "Rapid checkpoint", detail: "Check confidence." },
      3,
      scope,
      mission.mission_id,
    );

    expect(study.mode).toBe("study");
    expect(revision.mode).toBe("revision");
    expect(exam.mode).toBe("exam");
    expect(checkpoint.mode).toBe("checkpoint");
    [study, revision, exam, checkpoint].forEach((destination, index) => {
      expect(destination.href).toContain(`planId=${mission.mission_id}`);
      expect(destination.href).toContain(`planBlock=${index + 1}`);
    });
    expect(getPlanningHandoffs(scope, mission.mission_id).map((item) => item.mode)).toEqual([
      "study",
      "revision",
      "exam",
    ]);
  });

  it("uses confirmed JSON mutations with no automatic POST retry", () => {
    const api = readSource("features/planning/api.ts");
    const checkpoint = readSource("features/planning/PlanningCheckpoint.tsx");

    expect(api).toContain("apiJson");
    expect(api.match(/retries:\s*0/g)?.length).toBeGreaterThanOrEqual(2);
    expect(api).toContain('session_type: "planning_checkpoint"');
    expect(checkpoint).not.toContain("Response saved");
    expect(checkpoint).toContain("checkpoint recorded.");
  });

  it("invalidates an active plan when setup state changes", () => {
    const provider = readSource("features/planning/PlanningExperience.tsx");
    expect(provider).toContain("retireActivePlan()");
    expect(provider).toContain("previous plan no longer matches this setup");
    expect(provider).toContain("clearActivePlanningPlan(userId)");
  });

  it("keeps Planning parent-sized with one route scroll owner and no viewport units", () => {
    const css = readSource("features/planning/planning.module.css");
    expect(css).not.toMatch(/100(?:d|s|l)?vh/);
    expect(css).toMatch(/\.screen\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/\.scroll\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/);
    expect(css.match(/overflow-y:\s*auto/g)).toHaveLength(1);
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
