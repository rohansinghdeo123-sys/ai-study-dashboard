"use client";

import { useAuth } from "@/context/AuthContext";
import { AlertState, AppIcon, LoadingState } from "@/components/ui/Polished";
import { apiFetch } from "@/lib/apiClient";
import { reconcileSelection, useCatalog } from "@/lib/catalog";
import { BUCKET_CHIPS, BUCKET_LABELS, fetchRevisionQueue, type RevisionEntry } from "@/lib/revision";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./planning-market.module.css";

interface MissionPlanStep {
  title: string;
  duration?: string;
  detail: string;
  focus?: string;
}

interface MissionQuestion {
  id?: string;
  topic?: string;
  subtopic?: string;
  question: string;
  options: string[];
  correct: string;
  explanation?: string;
}

interface MissionRoadmapStep {
  condition: string;
  next_step: string;
  mentor_action: string;
}

interface AutonomousMission {
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

interface MissionProfile {
  currentKnowledge: string;
  learningGoal: string;
  availableMinutes: string;
  examTarget: string;
  preferredStyle: string;
  prerequisiteConfidence: string;
}

const KNOWLEDGE_OPTIONS = [
  { label: "New to this", value: "new" },
  { label: "Weak basics", value: "weak_basics" },
  { label: "Some idea", value: "some_idea" },
  { label: "Know basics", value: "know_basics" },
];

const GOAL_OPTIONS = [
  { label: "Deep understanding", value: "deep_understanding" },
  { label: "Exam scoring", value: "exam" },
  { label: "Quick revision", value: "quick_revision" },
  { label: "Fast track", value: "fast_track" },
];

const EXAM_OPTIONS = [
  { label: "School exam", value: "school_exam" },
  { label: "Boards", value: "boards" },
  { label: "JEE", value: "jee" },
  { label: "NEET", value: "neet" },
  { label: "Quick revision", value: "quick_revision" },
];

const STYLE_OPTIONS = [
  { label: "Examples first", value: "examples_first" },
  { label: "Short explanations", value: "short_explanations" },
  { label: "Conceptual detail", value: "conceptual_detail" },
  { label: "Visual intuition", value: "visual_intuition" },
];

const CONFIDENCE_OPTIONS = [
  { label: "Low", value: "low", score: 35 },
  { label: "Okay", value: "medium", score: 62 },
  { label: "Strong", value: "high", score: 82 },
];

function confidenceToScore(value: string) {
  const normalized = value === "weak" || value === "not_confident" ? "low" : value;
  return CONFIDENCE_OPTIONS.find((option) => option.value === normalized)?.score ?? 62;
}

function clampMetric(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function calculateFocusScore({
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

const PREREQ_OPTIONS = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

function formatLabel(value?: string | number) {
  if (value === undefined || value === null || value === "") return "Not set";
  return String(value).replace(/_/g, " ");
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function ProfileSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className={styles.fieldLabel}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={styles.field}
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildReport(mission: AutonomousMission, correct: boolean) {
  const topic = formatLabel(mission.target_topic);
  return {
    title: correct ? "Strong first signal" : "Weak point detected",
    summary: correct
      ? `You understood the first diagnostic for ${topic}. Now move into application so the learning becomes exam-ready.`
      : `This is useful feedback. The diagnostic found a gap in ${topic}, so the next step is to rebuild the exact concept before more practice.`,
    next: correct
      ? [`Try two exam-style application questions on ${topic}.`, "Explain the concept once in your own words.", "Move to the next diagnostic after 80% confidence."]
      : [`Ask the Study tutor for a simpler explanation of ${topic}.`, "Learn one real-life example and one common mistake.", "Retry one similar question before increasing difficulty."],
  };
}

function PlanBuildState({ topic }: { topic: string }) {
  const steps = ["Checking prerequisites", "Optimizing study order", "Preparing diagnostic"];

  return (
    <div className={styles.buildState} role="status" aria-live="polite">
      <div className={styles.buildStateInner}>
        <p className={styles.eyebrow}>Building your plan</p>
        <h2 className={styles.buildTitle}>
          Creating your fastest path for {formatLabel(topic)}
        </h2>
        <p className={styles.buildCopy}>The planner is keeping the route focused, realistic, and practical.</p>
        <div className={styles.buildSteps}>
          {steps.map((step, index) => (
            <div key={step} className={styles.buildStep}>
              <span
                className={cn(styles.buildDot, index === 0 && styles.buildDotActive)}
              />
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightGroup({
  title,
  items,
  tone = "teal",
}: {
  title: string;
  items: string[];
  tone?: "teal" | "gold" | "rose";
}) {
  if (!items.length) return null;

  return (
    <article className={styles.insightGroup}>
      <h3>{title}</h3>
      <div className={styles.insightList}>
        {items.map((item) => (
          <div key={item} className={styles.insightItem}>
            <span className={styles.insightDot} data-tone={tone} />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function getMissionReadiness(profile: MissionProfile) {
  const minutes = Number(profile.availableMinutes) || 0;
  const confidence = confidenceToScore(profile.prerequisiteConfidence);
  const timeScore = minutes >= 45 ? 34 : minutes >= 25 ? 27 : 18;
  const goalScore = profile.learningGoal === "fast_track" ? 24 : profile.learningGoal === "quick_revision" ? 26 : 30;
  const readiness = clampMetric(timeScore + Math.round(confidence * 0.36) + goalScore);

  return {
    score: readiness,
    label: readiness >= 78 ? "Strong launch" : readiness >= 58 ? "Ready to start" : "Use a tighter path",
  };
}

export default function PlanningWorkspace() {
  const { profile: accountProfile, userId, loading, claimsLoading, getAuthHeaders } = useAuth();
  const searchParams = useSearchParams();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  const [chapter, setChapter] = useState(searchParams.get("chapter") || "hydrocarbon");
  const [topic, setTopic] = useState(searchParams.get("topic") || "alkanes");
  const [profile, setProfile] = useState<MissionProfile>({
    currentKnowledge: "some_idea",
    learningGoal: "exam",
    availableMinutes: "45",
    examTarget: "school_exam",
    preferredStyle: "examples_first",
    prerequisiteConfidence: "medium",
  });
  const [mission, setMission] = useState<AutonomousMission | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [diagnosticHintOpen, setDiagnosticHintOpen] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [answerRetryCount, setAnswerRetryCount] = useState(0);
  const [answerConfidence, setAnswerConfidence] = useState("medium");
  const [submitted, setSubmitted] = useState(false);
  const [loadingMission, setLoadingMission] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [revisionRadar, setRevisionRadar] = useState<RevisionEntry[]>([]);
  const [setupOpen, setSetupOpen] = useState(false);
  const [diagnosticOpen, setDiagnosticOpen] = useState(true);
  const missionStartedAtRef = useRef<string | null>(null);
  const missionResponseLatencyRef = useRef(0);
  const firstAnswerAtRef = useRef<string | null>(null);
  const lastAnswerRef = useRef("");
  const setupRailRef = useRef<HTMLElement | null>(null);
  const setupTriggerRef = useRef<HTMLButtonElement | null>(null);
  const setupCloseRef = useRef<HTMLButtonElement | null>(null);
  const canvasHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const authBusy = loading || claimsLoading;
  const { chapters } = useCatalog();
  const selectedChapter = chapters.find((item) => item.value === chapter) || chapters[0];

  // Snap to a valid selection when the published catalog replaces the
  // built-in chapter list.
  useEffect(() => {
    const next = reconcileSelection(chapters, chapter, topic);
    if (next.changed) {
      setChapter(next.chapter);
      setTopic(next.topic);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters]);
  const missionReadiness = useMemo(() => getMissionReadiness(profile), [profile]);

  // Revision radar: spaced-repetition suggestions for what to run a mission on.
  // Additive — the page never waits on it and hides the card when empty.
  useEffect(() => {
    if (!userId || authBusy) return;
    let cancelled = false;
    (async () => {
      const payload = await fetchRevisionQueue(backendURL, userId, await getAuthHeaders(), 4);
      if (!cancelled && payload) {
        setRevisionRadar(payload.queue.filter((entry) => entry.bucket !== "fresh").slice(0, 3));
      }
    })();
    return () => { cancelled = true; };
  }, [authBusy, backendURL, getAuthHeaders, userId]);

  // Map a revision topic back to a catalog chapter/topic so one tap can aim
  // the mission at it. Falls back to label-only display when not in catalog.
  const radarTarget = (entryTopic: string) => {
    const normalized = entryTopic.trim().toLowerCase();
    for (const chapterItem of chapters) {
      const match = chapterItem.topics.find(
        (t) => t.value.toLowerCase() === normalized || t.label.toLowerCase() === normalized,
      );
      if (match) return { chapter: chapterItem.value, topic: match.value, label: match.label };
    }
    return null;
  };

  const plan = mission?.study_plan || mission?.result?.data?.study_plan || [];
  const question = mission?.diagnostic_question || mission?.result?.data?.questions?.[0] || null;
  const roadmap = mission?.adaptive_roadmap || mission?.result?.data?.adaptive_roadmap || [];
  const highPriority = mission?.high_priority_concepts || [];
  const fastRevision = mission?.fast_revision_strategy || [];
  const weaknessPoints = mission?.weakness_detection_points || [];
  const confidenceCheck = mission?.final_confidence_check || [];
  const fastTrack = mission?.fast_track_strategy || [];
  const routeSteps: MissionPlanStep[] = plan.length
    ? plan
    : (mission?.steps || []).map((detail, index) => ({
        title: `Step ${index + 1}`,
        detail,
        duration: "Focused work",
      }));
  const isCorrect = Boolean(question && selectedAnswer === question.correct);
  const report = useMemo(() => (mission && submitted ? buildReport(mission, isCorrect) : null), [isCorrect, mission, submitted]);
  const hasFocusDetails = Boolean(
    mission?.prerequisite_check ||
      fastTrack.length ||
      highPriority.length ||
      fastRevision.length ||
      weaknessPoints.length ||
      roadmap.length ||
      confidenceCheck.length,
  );
  const setupActionIsPrimary = !mission || !question || submitted;
  const diagnosticHint = question
    ? `Focus on the core idea in ${question.subtopic || question.topic || mission?.target_topic || "this topic"} before comparing the options.`
    : "";

  const startMission = async () => {
    if (!userId || authBusy || loadingMission) return;
    const requestStartedAt = Date.now();
    setLoadingMission(true);
    setError("");
    setSubmitted(false);
    setDiagnosticOpen(true);
    setSelectedAnswer("");
    setDiagnosticHintOpen(false);
    setHintCount(0);
    setAnswerRetryCount(0);
    setAnswerConfidence(profile.prerequisiteConfidence === "low" ? "low" : profile.prerequisiteConfidence === "high" ? "high" : "medium");
    firstAnswerAtRef.current = null;
    lastAnswerRef.current = "";
    missionStartedAtRef.current = null;
    missionResponseLatencyRef.current = 0;

    try {
      const res = await apiFetch(`${backendURL}/coach/autonomous-study/${userId}`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          current_topic: topic,
          current_chapter: chapter,
          subject: "Chemistry",
          current_knowledge: profile.currentKnowledge,
          learning_goal: profile.learningGoal,
          available_minutes: Number(profile.availableMinutes) || undefined,
          exam_target: profile.examTarget,
          preferred_style: profile.preferredStyle,
          prerequisite_confidence: profile.prerequisiteConfidence,
        }),
        retries: 1,
        timeoutMs: 18000,
      });

      if (!res.ok) throw new Error(`Mission failed: ${res.status}`);
      const data = (await res.json()) as AutonomousMission;
      setMission(data);
      setSetupOpen(false);
      if (setupOpen) {
        window.requestAnimationFrame(() => canvasHeadingRef.current?.focus());
      }
      missionStartedAtRef.current = new Date().toISOString();
      missionResponseLatencyRef.current = Date.now() - requestStartedAt;
    } catch {
      setError("Your plan could not be created. Please try again.");
    } finally {
      setLoadingMission(false);
    }
  };

  const selectDiagnosticAnswer = (option: string) => {
    if (submitted) return;
    if (!firstAnswerAtRef.current) firstAnswerAtRef.current = new Date().toISOString();
    if (lastAnswerRef.current && lastAnswerRef.current !== option) {
      setAnswerRetryCount((current) => current + 1);
    }
    lastAnswerRef.current = option;
    setSelectedAnswer(option);
  };

  const revealDiagnosticHint = () => {
    if (!diagnosticHintOpen) setHintCount((current) => current + 1);
    setDiagnosticHintOpen(true);
  };

  const submitAnswer = async () => {
    if (!question || !selectedAnswer || submitted) return;
    setSubmitted(true);

    if (!userId || !mission) return;
    const completedAt = new Date();
    const startedAt = missionStartedAtRef.current || firstAnswerAtRef.current || completedAt.toISOString();
    const startedAtMs = new Date(startedAt).getTime();
    const durationSeconds = Number.isFinite(startedAtMs)
      ? Math.max(1, Math.round((completedAt.getTime() - startedAtMs) / 1000))
      : 1;
    const confidenceBefore = confidenceToScore(profile.prerequisiteConfidence);
    const confidenceAfter = confidenceToScore(answerConfidence);
    const focusScore = calculateFocusScore({
      correct: isCorrect,
      durationSeconds,
      hintCount,
      retryCount: answerRetryCount,
      confidenceAfter,
    });
    setSaving(true);
    try {
      await apiFetch(`${backendURL}/submit-session`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          user_id: userId,
          topic: mission.target_topic,
          subject: mission.subject || "Chemistry",
          score: isCorrect ? 1 : 0,
          total_questions: 1,
          xp_earned: isCorrect ? 10 : 0,
          time_spent_seconds: durationSeconds,
          focus_score: focusScore,
          session_type: "autonomous_mission",
          started_at: startedAt,
          completed_at: completedAt.toISOString(),
          response_latency_ms: missionResponseLatencyRef.current,
          hint_count: hintCount,
          retry_count: answerRetryCount,
          confidence_before: confidenceBefore,
          confidence_after: confidenceAfter,
          replay_data: {
            topic: mission.target_topic,
            source: "autonomous_mission",
            telemetry: {
              started_at: startedAt,
              first_answer_at: firstAnswerAtRef.current,
              completed_at: completedAt.toISOString(),
              duration_seconds: durationSeconds,
              mission_response_latency_ms: missionResponseLatencyRef.current,
              hint_count: hintCount,
              retry_count: answerRetryCount,
              confidence_before: confidenceBefore,
              confidence_after: confidenceAfter,
              focus_score: focusScore,
            },
            questions: [
              {
                id: question.id,
                text: question.question,
                topic: question.topic || mission.target_topic,
                subtopic: question.subtopic || "",
                options: question.options,
                correct_answer: question.correct,
                user_answer: selectedAnswer,
                is_correct: isCorrect,
                ai_explanation: question.explanation || "",
              },
            ],
          },
        }),
        retries: 1,
        timeoutMs: 9000,
      });
    } catch {
      setError("Answer saved locally in the plan, but the session could not be logged.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!setupOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setupCloseRef.current?.focus();

    const manageDrawerKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSetupOpen(false);
        setupTriggerRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !setupRailRef.current) return;
      const focusable = Array.from(
        setupRailRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), input:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", manageDrawerKeyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", manageDrawerKeyboard);
    };
  }, [setupOpen]);

  if (authBusy) {
    return (
      <div className={styles.stateFrame}>
        <LoadingState title="Preparing Planning..." detail="Checking your profile and getting the planner ready." />
      </div>
    );
  }

  return (
    <div className={styles.workspace}>
      <button
        type="button"
        aria-label="Close planning setup"
        className={cn(styles.drawerScrim, setupOpen && styles.drawerScrimVisible)}
        onClick={() => {
          setSetupOpen(false);
          setupTriggerRef.current?.focus();
        }}
        tabIndex={setupOpen ? 0 : -1}
      />

      <aside
        ref={setupRailRef}
        id="planning-setup"
        aria-label="Planning setup"
        aria-modal={setupOpen || undefined}
        role={setupOpen ? "dialog" : undefined}
        className={cn(styles.setupRail, setupOpen && styles.setupRailOpen)}
      >
        <div className={styles.setupRailHeader}>
          <div>
            <p className={styles.eyebrow}>
              Planning setup{accountProfile?.classLevel ? ` / ${accountProfile.classLevel}` : ""}
            </p>
            <h2>Shape your route</h2>
          </div>
          <button
            ref={setupCloseRef}
            type="button"
            aria-label="Close planning setup"
            className={styles.drawerClose}
            onClick={() => {
              setSetupOpen(false);
              setupTriggerRef.current?.focus();
            }}
          >
            <AppIcon name="x" />
          </button>
        </div>
        <p className={styles.setupIntro}>
          Set one clear target. AgentifyAI will turn it into the shortest useful study plan.
        </p>

        <div className={styles.readinessCard}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={styles.miniLabel}>Planning readiness</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{missionReadiness.label}</h2>
            </div>
            <strong className={styles.readinessScore}>
              {missionReadiness.score}%
            </strong>
          </div>
          <div
            className={styles.readinessTrack}
            role="progressbar"
            aria-label="Planning readiness"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={missionReadiness.score}
          >
            <span
              className={styles.readinessFill}
              style={{ width: `${missionReadiness.score}%` }}
            />
          </div>
          <div className={styles.readinessFacts}>
            <span>
              {profile.availableMinutes} min
            </span>
            <span>
              {formatLabel(profile.learningGoal)}
            </span>
            <span>
              {formatLabel(profile.prerequisiteConfidence)}
            </span>
          </div>
        </div>

        <div className={styles.setupSection}>
          <div className={styles.setupSectionHeading}>
            <span>1</span>
            <div>
              <h3>Choose the target</h3>
              <p>Plan around one chapter and topic.</p>
            </div>
          </div>
          <div className={styles.targetFields}>
            <label>
              <span className={styles.fieldLabel}>Chapter</span>
              <select
                value={chapter}
                onChange={(event) => {
                  const next = event.target.value;
                  setChapter(next);
                  setTopic(chapters.find((item) => item.value === next)?.topics[0]?.value || "");
                }}
                className={styles.field}
              >
                {chapters.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={styles.fieldLabel}>Topic</span>
              <select
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className={styles.field}
              >
                {selectedChapter.topics.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {revisionRadar.length ? (
          <details className={styles.railDisclosure}>
            <summary>
              <span>
                <strong>Revision radar</strong>
                <small>Memory-based targets</small>
              </span>
              <span className={styles.summaryCount}>{revisionRadar.length}</span>
            </summary>
            <div className={styles.radarList}>
              {revisionRadar.map((entry) => {
                const target = radarTarget(entry.topic);
                const label = target?.label || formatLabel(entry.topic);
                return (
                  <button
                    key={entry.topic}
                    type="button"
                    disabled={!target}
                    onClick={() => {
                      if (!target) return;
                      setChapter(target.chapter);
                      setTopic(target.topic);
                    }}
                    className={styles.radarItem}
                    title={target ? `Plan for ${label}` : undefined}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-semibold capitalize text-slate-800">{label}</span>
                      <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold", BUCKET_CHIPS[entry.bucket])}>
                        {BUCKET_LABELS[entry.bucket]} / {entry.suggested_minutes}m
                      </span>
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 text-slate-500">{entry.reason}</span>
                  </button>
                );
              })}
            </div>
          </details>
        ) : null}

        <details className={styles.railDisclosure} open>
          <summary>
            <span>
              <strong>2 / Learning fit</strong>
              <small>Personalize pace and depth</small>
            </span>
          </summary>
          <div className={styles.profileFields}>
            <ProfileSelect
              label="Current knowledge"
              value={profile.currentKnowledge}
              options={KNOWLEDGE_OPTIONS}
              onChange={(value) => setProfile((current) => ({ ...current, currentKnowledge: value }))}
            />
            <ProfileSelect
              label="Plan goal"
              value={profile.learningGoal}
              options={GOAL_OPTIONS}
              onChange={(value) => setProfile((current) => ({ ...current, learningGoal: value }))}
            />
            <label className="block">
              <span className={styles.fieldLabel}>Available time</span>
              <input
                type="number"
                min={10}
                max={240}
                value={profile.availableMinutes}
                onChange={(event) => setProfile((current) => ({ ...current, availableMinutes: event.target.value }))}
                className={styles.field}
              />
            </label>
            <ProfileSelect
              label="Exam target"
              value={profile.examTarget}
              options={EXAM_OPTIONS}
              onChange={(value) => setProfile((current) => ({ ...current, examTarget: value }))}
            />
            <ProfileSelect
              label="Preferred style"
              value={profile.preferredStyle}
              options={STYLE_OPTIONS}
              onChange={(value) => setProfile((current) => ({ ...current, preferredStyle: value }))}
            />
            <ProfileSelect
              label="Prerequisite confidence"
              value={profile.prerequisiteConfidence}
              options={PREREQ_OPTIONS}
              onChange={(value) => setProfile((current) => ({ ...current, prerequisiteConfidence: value }))}
            />
          </div>
        </details>

        <button
          type="button"
          onClick={startMission}
          disabled={loadingMission || saving || !userId}
          className={cn(
            styles.setupAction,
            setupActionIsPrimary ? styles.setupActionPrimary : styles.setupActionSecondary,
          )}
        >
          <AppIcon name={loadingMission ? "clock" : "mission"} />
          <span>
            {loadingMission
              ? "Building your plan..."
              : mission
                ? submitted || !question
                  ? "Build another plan"
                  : "Rebuild plan"
                : "Build my plan"}
          </span>
        </button>
        <p className={styles.actionNote}>Uses the setup above without changing your saved learning history.</p>

        <details className={styles.railDisclosure}>
          <summary>
            <span>
              <strong>How Planning works</strong>
              <small>Three useful guardrails</small>
            </span>
          </summary>
          <div className={styles.guidanceList}>
            <p><span>1</span> Set your time and exam target honestly.</p>
            <p><span>2</span> Follow the timed route without adding unnecessary theory.</p>
            <p><span>3</span> Use the final confidence check before moving on.</p>
          </div>
        </details>
      </aside>

      <main className={styles.planCanvas}>
        <header className={styles.canvasHeader}>
          <div className={styles.canvasTitleGroup}>
            <p className={styles.eyebrow}>Planning / Chemistry</p>
            <h1 ref={canvasHeadingRef} tabIndex={-1}>Planning</h1>
            <p>Turn one topic into a focused route you can actually finish.</p>
          </div>
          <div className={styles.canvasHeaderActions}>
            <span className={styles.planStatus} data-ready={mission ? "true" : "false"}>
              <span />
              {mission ? "Plan ready" : "Setup required"}
            </span>
            <button
              ref={setupTriggerRef}
              type="button"
              aria-controls="planning-setup"
              aria-expanded={setupOpen}
              className={styles.setupTrigger}
              onClick={() => setSetupOpen(true)}
            >
              <AppIcon name="panelLeft" />
              <span>Plan setup</span>
            </button>
          </div>
        </header>

        {error ? (
          <div className={styles.canvasAlert} role="alert">
            <AlertState message={error} />
          </div>
        ) : null}

        <div className={styles.canvasBody}>
        {loadingMission ? (
          <PlanBuildState topic={topic} />
        ) : !mission ? (
          <div className={styles.emptyPlan}>
            <div className={styles.emptyPlanIcon}><AppIcon name="mission" /></div>
            <p className={styles.eyebrow}>Plan canvas</p>
            <h2>Your focused route will appear here.</h2>
            <p>
              Choose a topic and learning fit in Plan setup. The planner will prioritize, sequence, and verify the work.
            </p>
            <div className={styles.emptyStages} aria-label="Planning output">
              {["Prioritize", "Sequence", "Verify"].map((label, index) => (
                <div key={label}>
                  <span>{index + 1}</span>
                  <strong>{label}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.planResult}>
            <section className={styles.planHero} aria-labelledby="plan-objective">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className={styles.eyebrow}>Adaptive learning plan</p>
                  <h2 id="plan-objective">{mission.objective}</h2>
                  <p className={styles.planWhy}>{mission.why}</p>
                  {mission.mission_goal ? (
                    <p className={styles.planGoal}>
                      {mission.mission_goal}
                    </p>
                  ) : null}
                </div>
                <div className={styles.durationPill}>
                  <AppIcon name="clock" />
                  {mission.estimated_minutes || 15} min
                </div>
              </div>
            </section>

            <section className={styles.routePanel} aria-labelledby="plan-route-heading">
              <div className={styles.routeHeader}>
                <div>
                  <p className={styles.eyebrow}>Dominant route</p>
                  <h2 id="plan-route-heading">Your study plan</h2>
                </div>
                <span>{routeSteps.length} {routeSteps.length === 1 ? "step" : "steps"}</span>
              </div>
              {routeSteps.length ? (
                <ol className={styles.routeList}>
                  {routeSteps.map((step, index) => (
                    <li key={`${step.title}-${index}`} className={styles.routeStep}>
                      <div className={styles.routeIndex}>{index + 1}</div>
                      <div className={styles.routeStepCopy}>
                        <div>
                          <h3>{step.title}</h3>
                          <span>{step.duration || "Focused work"}</span>
                        </div>
                        <p>{step.detail}</p>
                        {step.focus ? <small>Focus: {step.focus}</small> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.routeEmpty}>The plan is ready. Follow the objective above as your first focused block.</p>
              )}
            </section>

            {hasFocusDetails ? (
              <details className={styles.contentDisclosure}>
                <summary>
                  <span>
                    <strong>Focus & strategy</strong>
                    <small>Prerequisites, priorities, revision, and decision paths</small>
                  </span>
                  <span className={styles.disclosureAction}>View details</span>
                </summary>
                <div className={styles.disclosureBody}>
                  <div className={styles.insightGrid}>
                    {mission.prerequisite_check ? (
                      <article className={styles.insightGroup}>
                        <h3>Prerequisite check</h3>
                        <strong className={styles.insightStatus}>
                          {mission.prerequisite_check.status
                            ? formatLabel(mission.prerequisite_check.status)
                            : "Ready check"}
                        </strong>
                        {mission.prerequisite_check.question ? <p>{mission.prerequisite_check.question}</p> : null}
                        {mission.prerequisite_check.action ? <small>{mission.prerequisite_check.action}</small> : null}
                      </article>
                    ) : null}
                    <InsightGroup title="Fast-track strategy" items={fastTrack} tone="gold" />
                    <InsightGroup title="High-priority concepts" items={highPriority} />
                    <InsightGroup title="Revision emphasis" items={fastRevision} />
                    <InsightGroup title="Weakness detection" items={weaknessPoints} tone="rose" />
                  </div>

                  {roadmap.length ? (
                    <div className={styles.roadmapBlock}>
                      <h3>Adaptive roadmap</h3>
                      <div className={styles.roadmapList}>
                        {roadmap.map((item) => (
                          <article key={item.condition}>
                            <strong>{item.condition}</strong>
                            <p>{item.next_step}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {confidenceCheck.length ? (
                    <div className={styles.confidenceBlock}>
                      <h3>Final confidence check</h3>
                      <div>
                        {confidenceCheck.map((item) => (
                          <p key={item}><AppIcon name="check" />{item}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}

            {question ? (
              <details
                key={mission.mission_id}
                className={styles.contentDisclosure}
                open={diagnosticOpen}
                onToggle={(event) => setDiagnosticOpen(event.currentTarget.open)}
              >
                <summary>
                  <span>
                    <strong>Diagnostic checkpoint</strong>
                    <small>{submitted ? "Response captured" : "One question to test the route"}</small>
                  </span>
                  <span className={cn(styles.checkpointStatus, submitted && styles.checkpointStatusComplete)}>
                    {submitted ? "Complete" : "Ready"}
                  </span>
                </summary>
                <div className={styles.diagnosticBody}>
                <h3 className={styles.diagnosticQuestion}>{question.question}</h3>
                <div className={styles.optionList}>
                  {question.options.map((option) => {
                    const active = selectedAnswer === option;
                    const correctOption = submitted && option === question.correct;
                    const wrongOption = submitted && active && option !== question.correct;
                    return (
                      <button
                        type="button"
                        key={option}
                        onClick={() => selectDiagnosticAnswer(option)}
                        disabled={submitted}
                        aria-pressed={active}
                        className={cn(
                          styles.optionButton,
                          active && !submitted && styles.optionButtonActive,
                          correctOption && styles.optionButtonCorrect,
                          wrongOption && styles.optionButtonWrong,
                        )}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                <div className={styles.confidenceSelector}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className={styles.miniLabel}>Current confidence</p>
                      <p>This helps the coach measure real confidence change, not just marks.</p>
                    </div>
                    <div className={styles.confidenceChoices} role="group" aria-label="Current confidence">
                      {CONFIDENCE_OPTIONS.map((option) => (
                        <button
                          type="button"
                          key={option.value}
                          onClick={() => !submitted && setAnswerConfidence(option.value)}
                          disabled={submitted}
                          className={cn(
                            styles.confidenceChoice,
                            answerConfidence === option.value && styles.confidenceChoiceActive,
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={styles.hintRow}>
                  <button
                    type="button"
                    onClick={revealDiagnosticHint}
                    disabled={submitted || diagnosticHintOpen}
                    className={styles.hintButton}
                  >
                    <AppIcon name="spark" />
                    <span>{diagnosticHintOpen ? "Hint used" : "Use one hint"}</span>
                  </button>
                  {diagnosticHintOpen ? (
                    <p className={styles.hintCopy} role="status">
                      {diagnosticHint}
                    </p>
                  ) : null}
                </div>
                {!submitted ? (
                  <button
                    type="button"
                    onClick={submitAnswer}
                    disabled={!selectedAnswer}
                    className={styles.diagnosticPrimary}
                  >
                    <AppIcon name="send" />
                    <span>Check answer</span>
                  </button>
                ) : (
                  <div className={styles.diagnosticComplete} role="status" aria-live="polite">
                    <AppIcon name={saving ? "clock" : "check"} />
                    <span>{saving ? "Saving your response..." : "Response saved"}</span>
                  </div>
                )}
                {submitted && question.explanation ? (
                  <p className={styles.explanation}>
                    {question.explanation}
                  </p>
                ) : null}
                </div>
              </details>
            ) : null}

            {report ? (
              <details className={cn(styles.contentDisclosure, styles.reportDisclosure)} open>
                <summary>
                  <span>
                    <strong>Performance report</strong>
                    <small>Signal and recommended next moves</small>
                  </span>
                  <span className={styles.checkpointStatus}>Ready</span>
                </summary>
                <div className={styles.reportBody}>
                  <h3>{report.title}</h3>
                  <p>{report.summary}</p>
                  <div>
                    {report.next.map((item) => (
                      <p key={item}><AppIcon name="arrowRight" />{item}</p>
                    ))}
                  </div>
                </div>
              </details>
            ) : null}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
