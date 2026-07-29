export interface MissionPlanStep {
  title: string;
  duration?: string;
  detail: string;
  focus?: string;
}

export interface MissionQuestion {
  id?: string;
  topic?: string;
  subtopic?: string;
  question: string;
  options: string[];
  correct: string;
  explanation?: string;
}

export interface MissionRoadmapStep {
  condition: string;
  next_step: string;
  mentor_action?: string;
}

export interface AutonomousMission {
  mission_id: string;
  status: string;
  subject: string;
  chapter?: string;
  target_topic: string;
  target_source: string;
  mission_type?: string;
  priority?: string;
  mastery_band?: string;
  estimated_minutes?: number;
  mission_goal?: string;
  prerequisite_check?: {
    status?: string;
    question?: string;
    action?: string;
  };
  high_priority_concepts?: string[];
  fast_revision_strategy?: string[];
  weakness_detection_points?: string[];
  final_confidence_check?: string[];
  fast_track_strategy?: string[];
  objective: string;
  why: string;
  steps: string[];
  next_actions: string[];
  success_criteria?: string[];
  study_plan?: MissionPlanStep[];
  diagnostic_question?: MissionQuestion;
  adaptive_roadmap?: MissionRoadmapStep[];
  result?: {
    data?: {
      questions?: MissionQuestion[];
      study_plan?: MissionPlanStep[];
      adaptive_roadmap?: MissionRoadmapStep[];
    };
  };
}

export interface PlanningProfile {
  currentKnowledge: string;
  learningGoal: string;
  availableMinutes: string;
  examTarget: string;
  preferredStyle: string;
  prerequisiteConfidence: string;
}

export interface PlanningDraft {
  chapter: string;
  topic: string;
  profile: PlanningProfile;
}

export interface PlanningScope {
  chapter: string;
  chapterLabel: string;
  topic: string;
  topicLabel: string;
  subject: string;
  classLevel: string;
}

export interface PlanningCheckpointResult {
  answer: string;
  confidence: string;
  correct: boolean;
  focusScore: number;
  savedAt: string;
  report: PlanningReport;
}

export interface PlanningReport {
  title: string;
  summary: string;
  next: string[];
}

export interface PlanningPlan {
  mission: AutonomousMission;
  scope: PlanningScope;
  profile: PlanningProfile;
  catalogSource: "published" | "starter";
  requestedMinutes: number;
  createdAt: string;
  responseLatencyMs?: number;
  checkpoint?: PlanningCheckpointResult;
}

export interface PlanningTimeFit {
  requested: number;
  planned: number;
  difference: number;
  state: "fits" | "over" | "unknown";
  label: string;
  detail: string;
}

export const DEFAULT_PLANNING_PROFILE: PlanningProfile = {
  currentKnowledge: "some_idea",
  learningGoal: "exam",
  availableMinutes: "45",
  examTarget: "school_exam",
  preferredStyle: "examples_first",
  prerequisiteConfidence: "medium",
};

export const KNOWLEDGE_OPTIONS = [
  { label: "New to this", value: "new" },
  { label: "Weak basics", value: "weak_basics" },
  { label: "Some idea", value: "some_idea" },
  { label: "Know basics", value: "know_basics" },
];

export const GOAL_OPTIONS = [
  { label: "Deep understanding", value: "deep_understanding" },
  { label: "Exam scoring", value: "exam" },
  { label: "Quick revision", value: "quick_revision" },
  { label: "Fast track", value: "fast_track" },
];

export const EXAM_OPTIONS = [
  { label: "School exam", value: "school_exam" },
  { label: "Boards", value: "boards" },
  { label: "JEE", value: "jee" },
  { label: "NEET", value: "neet" },
  { label: "Quick revision", value: "quick_revision" },
];

export const STYLE_OPTIONS = [
  { label: "Examples first", value: "examples_first" },
  { label: "Short explanations", value: "short_explanations" },
  { label: "Conceptual detail", value: "conceptual_detail" },
  { label: "Visual intuition", value: "visual_intuition" },
];

export const CONFIDENCE_OPTIONS = [
  { label: "Low", value: "low", score: 35 },
  { label: "Okay", value: "medium", score: 62 },
  { label: "Strong", value: "high", score: 82 },
];

export const PREREQUISITE_OPTIONS = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

export function formatPlanningLabel(value?: string | number) {
  if (value === undefined || value === null || value === "") return "Not set";
  return String(value).replace(/_/g, " ");
}

export function confidenceToScore(value: string) {
  const normalized = value === "weak" || value === "not_confident" ? "low" : value;
  return CONFIDENCE_OPTIONS.find((option) => option.value === normalized)?.score ?? 62;
}

export function clampMetric(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function calculatePlanningFocusScore({
  correct,
  durationSeconds,
  hintCount,
  retryCount,
  confidenceAfter,
}: {
  correct: boolean;
  durationSeconds: number;
  hintCount: number;
  retryCount: number;
  confidenceAfter: number;
}) {
  const durationPenalty = durationSeconds > 900 ? 10 : durationSeconds > 420 ? 5 : 0;
  const supportPenalty = Math.min(18, hintCount * 6 + retryCount * 4);
  const confidenceBonus = confidenceAfter >= 75 ? 6 : confidenceAfter <= 40 ? -6 : 0;
  return clampMetric((correct ? 78 : 58) + confidenceBonus - durationPenalty - supportPenalty);
}

export function getMissionPlan(mission?: AutonomousMission | null): MissionPlanStep[] {
  if (!mission) return [];
  const plan = mission.study_plan || mission.result?.data?.study_plan || [];
  if (plan.length) return plan;
  return (mission.steps || []).map((detail, index) => ({
    title: `Step ${index + 1}`,
    detail,
    duration: "Focused work",
  }));
}

export function getMissionQuestion(mission?: AutonomousMission | null) {
  return mission?.diagnostic_question || mission?.result?.data?.questions?.[0] || null;
}

export function getMissionRoadmap(mission?: AutonomousMission | null) {
  return mission?.adaptive_roadmap || mission?.result?.data?.adaptive_roadmap || [];
}

export function parsePlanningMinutes(value?: string | number) {
  const match = String(value || "").match(/\d+/);
  return match ? Math.max(0, Number(match[0])) : 0;
}

export function getPlanningTimeFit(plan?: PlanningPlan | null): PlanningTimeFit {
  const requested = Math.max(0, Number(plan?.requestedMinutes || 0));
  const steps = getMissionPlan(plan?.mission);
  const plannedFromSteps = steps.reduce((sum, step) => sum + parsePlanningMinutes(step.duration), 0);
  const planned = plannedFromSteps || Math.max(0, Number(plan?.mission.estimated_minutes || 0));

  if (!requested || !planned) {
    return {
      requested,
      planned,
      difference: 0,
      state: "unknown",
      label: "Review the timing",
      detail: "The coach did not return enough timing detail to verify this window.",
    };
  }

  if (planned <= requested) {
    const buffer = requested - planned;
    return {
      requested,
      planned,
      difference: buffer,
      state: "fits",
      label: "Fits your study window",
      detail: buffer
        ? `${planned} planned minutes leave a ${buffer}-minute buffer.`
        : `${planned} planned minutes use your full ${requested}-minute window.`,
    };
  }

  const over = planned - requested;
  return {
    requested,
    planned,
    difference: over,
    state: "over",
    label: "Needs more time",
    detail: `${planned} planned minutes are ${over} minutes over your ${requested}-minute window. Rebuild with more time or complete the first blocks now.`,
  };
}

export function buildPlanningReport(mission: AutonomousMission, correct: boolean): PlanningReport {
  const topic = formatPlanningLabel(mission.target_topic);
  return {
    title: correct ? "Strong first signal" : "Weak point detected",
    summary: correct
      ? `You understood the first diagnostic for ${topic}. Move into application so the signal becomes exam-ready.`
      : `The diagnostic found a gap in ${topic}. Rebuild that exact concept before adding more practice.`,
    next: correct
      ? [
          `Try two exam-style application questions on ${topic}.`,
          "Explain the concept once in your own words.",
          "Use revision after the next learning block to protect recall.",
        ]
      : [
          `Ask the Study tutor for a simpler explanation of ${topic}.`,
          "Learn one worked example and one common mistake.",
          "Retry a similar question before increasing difficulty.",
        ],
  };
}

export function isAutonomousMission(value: unknown): value is AutonomousMission {
  if (!value || typeof value !== "object") return false;
  const mission = value as Partial<AutonomousMission>;
  return Boolean(
    mission.mission_id &&
      mission.target_topic &&
      mission.objective &&
      Array.isArray(mission.steps),
  );
}
