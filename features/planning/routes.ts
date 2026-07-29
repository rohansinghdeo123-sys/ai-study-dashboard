import { EXAM_ROUTES, examHref } from "@/features/exam/routes";
import { revisionLessonHref } from "@/features/revision/routes";
import type { MissionPlanStep, PlanningScope } from "./contracts";

export const PLANNING_ROUTES = {
  home: "/dashboard/planning",
  new: "/dashboard/planning/new",
  active: "/dashboard/planning/active",
  checkpoint: "/dashboard/planning/checkpoint",
  review: "/dashboard/planning/review",
  history: "/dashboard/planning/history",
} as const;

export type PlanningRoute = (typeof PLANNING_ROUTES)[keyof typeof PLANNING_ROUTES];

function appendContext(href: string, values: Record<string, string | number>) {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  Object.entries(values).forEach(([key, value]) => params.set(key, String(value)));
  return `${path}?${params.toString()}`;
}

export function planningBuilderHref(scope?: Partial<PlanningScope> | null) {
  if (!scope?.chapter && !scope?.topic) return PLANNING_ROUTES.new;
  const params = new URLSearchParams();
  if (scope.chapter) params.set("chapter", scope.chapter);
  if (scope.topic) params.set("topic", scope.topic);
  return `${PLANNING_ROUTES.new}?${params.toString()}`;
}

export type PlanBlockDestination = {
  mode: "study" | "revision" | "exam" | "checkpoint";
  label: string;
  href: string;
};

export function getPlanBlockDestination(
  step: MissionPlanStep,
  index: number,
  scope: PlanningScope,
  missionId: string,
): PlanBlockDestination {
  const signal = `${step.title} ${step.detail} ${step.focus || ""}`.toLowerCase();
  const context = { planId: missionId, planBlock: index + 1 };

  if (signal.includes("checkpoint") || signal.includes("confidence check")) {
    return {
      mode: "checkpoint",
      label: "Open checkpoint",
      href: appendContext(PLANNING_ROUTES.checkpoint, context),
    };
  }

  if (signal.includes("revision") || signal.includes("recall")) {
    return {
      mode: "revision",
      label: "Revise this block",
      href: appendContext(revisionLessonHref(scope), context),
    };
  }

  if (
    signal.includes("application") ||
    signal.includes("exam") ||
    signal.includes("question") ||
    signal.includes("practice")
  ) {
    return {
      mode: "exam",
      label: "Practice this block",
      href: examHref(EXAM_ROUTES.mcq, scope, context),
    };
  }

  return {
    mode: "study",
    label: "Study this block",
    href: appendContext(
      `/dashboard/study?chapter=${encodeURIComponent(scope.chapter)}&topic=${encodeURIComponent(scope.topic)}`,
      context,
    ),
  };
}

export function getPlanningHandoffs(scope: PlanningScope, missionId: string) {
  const context = { planId: missionId };
  return [
    {
      mode: "study" as const,
      title: "Learn",
      detail: "Open the tutor on this exact topic.",
      href: appendContext(
        `/dashboard/study?chapter=${encodeURIComponent(scope.chapter)}&topic=${encodeURIComponent(scope.topic)}`,
        context,
      ),
    },
    {
      mode: "revision" as const,
      title: "Revise",
      detail: "Revisit the explanation and notes.",
      href: appendContext(revisionLessonHref(scope), context),
    },
    {
      mode: "exam" as const,
      title: "Test",
      detail: "Check application with focused MCQs.",
      href: examHref(EXAM_ROUTES.mcq, scope, context),
    },
  ];
}

