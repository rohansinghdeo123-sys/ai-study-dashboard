"use client";

import { useAuth } from "@/context/AuthContext";
import { AlertState, AppIcon, EmptyState, LoadingState } from "@/components/ui/Polished";
import { apiFetch } from "@/lib/apiClient";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

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

const CHAPTERS = [
  {
    label: "Hydrocarbon",
    value: "hydrocarbon",
    topics: [
      { label: "Alkanes", value: "alkanes" },
      { label: "Alkenes", value: "alkenes" },
      { label: "Alkynes", value: "alkynes" },
      { label: "Aromatic Hydrocarbons", value: "aromatics" },
    ],
  },
  {
    label: "Matter",
    value: "matter",
    topics: [
      { label: "Matter Definition", value: "matter_definition" },
      { label: "States of Matter", value: "states_of_matter" },
      { label: "Properties of Matter", value: "properties_of_matter" },
    ],
  },
];

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
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="agentify-field mt-2 w-full rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#0E7490]"
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
      : `This is useful feedback. The mission found a gap in ${topic}, so the next step is to rebuild the exact concept before more practice.`,
    next: correct
      ? [`Try two exam-style application questions on ${topic}.`, "Explain the concept once in your own words.", "Move to the next diagnostic after 80% confidence."]
      : [`Ask the Study tutor for a simpler explanation of ${topic}.`, "Learn one real-life example and one common mistake.", "Retry one similar question before increasing difficulty."],
  };
}

function MissionBuildState({ topic }: { topic: string }) {
  const steps = ["Checking prerequisites", "Optimizing study order", "Preparing diagnostic"];

  return (
    <div className="flex min-h-[420px] items-center justify-center" role="status" aria-live="polite">
      <div className="w-full max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0E7490]">Building mission</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Creating your fastest path for {formatLabel(topic)}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          The planner is keeping the route focused and practical.
        </p>
        <div className="mt-7 space-y-3">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center gap-3 border-b border-slate-200/80 py-3">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  index === 0 ? "bg-[#14B8A6] shadow-[0_0_0_6px_rgba(20,184,166,0.10)]" : "bg-slate-200"
                }`}
              />
              <span className="text-sm font-semibold text-slate-600">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MissionPage() {
  const { userId, loading, claimsLoading, getAuthHeaders } = useAuth();
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
  const missionStartedAtRef = useRef<string | null>(null);
  const missionResponseLatencyRef = useRef(0);
  const firstAnswerAtRef = useRef<string | null>(null);
  const lastAnswerRef = useRef("");

  const authBusy = loading || claimsLoading;
  const selectedChapter = CHAPTERS.find((item) => item.value === chapter) || CHAPTERS[0];

  const plan = mission?.study_plan || mission?.result?.data?.study_plan || [];
  const question = mission?.diagnostic_question || mission?.result?.data?.questions?.[0] || null;
  const roadmap = mission?.adaptive_roadmap || mission?.result?.data?.adaptive_roadmap || [];
  const highPriority = mission?.high_priority_concepts || [];
  const fastRevision = mission?.fast_revision_strategy || [];
  const weaknessPoints = mission?.weakness_detection_points || [];
  const confidenceCheck = mission?.final_confidence_check || [];
  const fastTrack = mission?.fast_track_strategy || [];
  const isCorrect = Boolean(question && selectedAnswer === question.correct);
  const report = useMemo(() => (mission && submitted ? buildReport(mission, isCorrect) : null), [isCorrect, mission, submitted]);
  const diagnosticHint = question
    ? `Focus on the core idea in ${question.subtopic || question.topic || mission?.target_topic || "this topic"} before comparing the options.`
    : "";

  const startMission = async () => {
    if (!userId || authBusy || loadingMission) return;
    const requestStartedAt = Date.now();
    setLoadingMission(true);
    setError("");
    setSubmitted(false);
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
      missionStartedAtRef.current = new Date().toISOString();
      missionResponseLatencyRef.current = Date.now() - requestStartedAt;
    } catch {
      setError("Mission could not start. Please try again.");
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
      setError("Answer saved locally in the mission, but the session could not be logged.");
    } finally {
      setSaving(false);
    }
  };

  if (authBusy) {
    return (
      <LoadingState title="Preparing Mission..." detail="Checking your profile and getting the mission builder ready." />
    );
  }

  return (
    <div className="grid min-h-[calc(100svh-105px)] w-full gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0E7490]">Autonomous Mission</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Fastest path to finish a topic.
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Select the topic, answer a few quick profile questions, then get a time-optimized roadmap with checkpoints and a final confidence signal.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <select
            value={chapter}
            onChange={(event) => {
              const next = event.target.value;
              setChapter(next);
              setTopic(CHAPTERS.find((item) => item.value === next)?.topics[0]?.value || "alkanes");
            }}
            className="agentify-field rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#0E7490]"
          >
            {CHAPTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            className="agentify-field rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#0E7490]"
          >
            {selectedChapter.topics.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-white/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Adaptive profile</p>
          <div className="mt-4 grid gap-3">
            <ProfileSelect
              label="Current knowledge"
              value={profile.currentKnowledge}
              options={KNOWLEDGE_OPTIONS}
              onChange={(value) => setProfile((current) => ({ ...current, currentKnowledge: value }))}
            />
            <ProfileSelect
              label="Mission goal"
              value={profile.learningGoal}
              options={GOAL_OPTIONS}
              onChange={(value) => setProfile((current) => ({ ...current, learningGoal: value }))}
            />
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Available time</span>
              <input
                type="number"
                min={10}
                max={240}
                value={profile.availableMinutes}
                onChange={(event) => setProfile((current) => ({ ...current, availableMinutes: event.target.value }))}
                className="agentify-field mt-2 w-full rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#0E7490]"
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
        </div>

        <button
          type="button"
          onClick={startMission}
          disabled={loadingMission || !userId}
          className="agentify-action agentify-action-primary mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0F172A,#0E7490,#14B8A6)] px-5 py-4 text-sm font-semibold text-white shadow-[0_20px_55px_rgba(14,116,144,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <AppIcon name={loadingMission ? "clock" : "mission"} />
          <span>{loadingMission ? "Building mission..." : mission ? "Refresh mission" : "Start mission"}</span>
        </button>

        {error ? <div className="mt-3"><AlertState message={error} /></div> : null}

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Guidance</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>1. Set your time and exam target honestly.</p>
            <p>2. Follow the timed roadmap without extra theory.</p>
            <p>3. Use the final confidence check to decide if the topic is complete.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
        {loadingMission ? (
          <MissionBuildState topic={topic} />
        ) : !mission ? (
          <EmptyState
            icon="mission"
            title="Create your mission"
            detail="The planner will remove unnecessary theory, prioritize high-yield concepts, and build the shortest useful route for your topic."
          />
        ) : (
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white/65 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0E7490]">
                    {formatLabel(mission.mission_type)}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">{mission.objective}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{mission.why}</p>
                  {mission.mission_goal ? (
                    <p className="mt-3 rounded-2xl bg-[#0E7490]/10 px-4 py-3 text-sm font-semibold leading-6 text-[#0E7490]">
                      {mission.mission_goal}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-2xl bg-[#0E7490]/10 px-4 py-3 text-sm font-semibold text-[#0E7490]">
                  {mission.estimated_minutes || 15} min
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white/65 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Prerequisite check</p>
                <h3 className="mt-3 text-base font-semibold text-slate-950">
                  {mission.prerequisite_check?.status ? formatLabel(mission.prerequisite_check.status) : "Ready check"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{mission.prerequisite_check?.question}</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#0E7490]">{mission.prerequisite_check?.action}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white/65 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Fast-track strategy</p>
                <div className="mt-3 space-y-2">
                  {fastTrack.map((item) => (
                    <div key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F2B84B]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {plan.map((step, index) => (
                <div key={`${step.title}-${index}`} className="rounded-3xl border border-slate-200 bg-white/65 p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0E7490] text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-950">{step.title}</h3>
                  <p className="mt-1 text-xs font-medium text-[#0E7490]">{step.duration || "Focus"}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{step.detail}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white/65 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">High priority concepts</p>
                <div className="mt-3 space-y-2">
                  {highPriority.map((item) => (
                    <div key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#14B8A6]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white/65 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Fast revision</p>
                <div className="mt-3 space-y-2">
                  {fastRevision.map((item) => (
                    <div key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0E7490]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white/65 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Weakness detection</p>
                <div className="mt-3 space-y-2">
                  {weaknessPoints.map((item) => (
                    <div key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {question ? (
              <div className="rounded-3xl border border-slate-200 bg-white/75 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">One diagnostic question</p>
                <h3 className="mt-3 text-xl font-semibold leading-8 text-slate-950">{question.question}</h3>
                <div className="mt-5 space-y-3">
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
                        className={cn(
                          "w-full rounded-2xl border p-4 text-left text-sm leading-6 transition",
                          active && !submitted && "border-[#0E7490]/35 bg-[#0E7490]/10 text-[#0E7490]",
                          !active && !submitted && "border-slate-200 bg-white/70 text-slate-600 hover:border-[#0E7490]/25 hover:bg-[#0E7490]/5",
                          correctOption && "border-emerald-400/40 bg-emerald-400/12 text-emerald-700",
                          wrongOption && "border-rose-400/40 bg-rose-400/12 text-rose-700",
                        )}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 rounded-3xl border border-slate-200 bg-white/65 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Current confidence</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">This helps the coach measure real confidence change, not just marks.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CONFIDENCE_OPTIONS.map((option) => (
                        <button
                          type="button"
                          key={option.value}
                          onClick={() => !submitted && setAnswerConfidence(option.value)}
                          disabled={submitted}
                          className={cn(
                            "rounded-2xl border px-4 py-2 text-xs font-semibold transition",
                            answerConfidence === option.value
                              ? "border-[#0E7490]/35 bg-[#0E7490]/10 text-[#0E7490]"
                              : "border-slate-200 bg-white/70 text-slate-500 hover:border-[#0E7490]/25",
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={revealDiagnosticHint}
                    disabled={submitted || diagnosticHintOpen}
                    className="agentify-action rounded-2xl border border-[#0E7490]/20 bg-white/70 px-4 py-2 text-sm font-semibold text-[#0E7490] transition hover:bg-[#0E7490]/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <AppIcon name="spark" />
                    <span>{diagnosticHintOpen ? "Hint used" : "Use one hint"}</span>
                  </button>
                  {diagnosticHintOpen ? (
                    <p className="rounded-2xl bg-[#0E7490]/10 px-4 py-3 text-sm leading-6 text-slate-600">
                      {diagnosticHint}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={!selectedAnswer || submitted}
                  className="agentify-action agentify-action-primary mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#0E7490] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0B5F76] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <AppIcon name={submitted ? "check" : "send"} />
                  <span>{submitted ? saving ? "Saving..." : "Submitted" : "Check answer"}</span>
                </button>
                {submitted && question.explanation ? (
                  <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    {question.explanation}
                  </p>
                ) : null}
              </div>
            ) : null}

            {report ? (
              <div className="rounded-3xl border border-[#0E7490]/20 bg-[#0E7490]/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0E7490]">Performance report</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">{report.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{report.summary}</p>
                <div className="mt-4 space-y-2">
                  {report.next.map((item) => (
                    <div key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#14B8A6]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {roadmap.length ? (
              <div className="rounded-3xl border border-slate-200 bg-white/65 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Adaptive roadmap</p>
                <div className="mt-4 space-y-3">
                  {roadmap.map((item) => (
                    <div key={item.condition} className="rounded-2xl border border-slate-200 bg-white/60 p-4">
                      <p className="text-sm font-semibold text-slate-900">{item.condition}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{item.next_step}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {confidenceCheck.length ? (
              <div className="rounded-3xl border border-[#14B8A6]/20 bg-[#14B8A6]/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0E7490]">Final confidence check</p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {confidenceCheck.map((item) => (
                    <div key={item} className="rounded-2xl border border-white/60 bg-white/55 p-4 text-sm font-semibold leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
