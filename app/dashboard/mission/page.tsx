"use client";

import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

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

function formatLabel(value?: string | number) {
  if (value === undefined || value === null || value === "") return "Not set";
  return String(value).replace(/_/g, " ");
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
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

export default function MissionPage() {
  const { userId, loading, claimsLoading, getAuthHeaders } = useAuth();
  const searchParams = useSearchParams();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  const [chapter, setChapter] = useState(searchParams.get("chapter") || "hydrocarbon");
  const [topic, setTopic] = useState(searchParams.get("topic") || "alkanes");
  const [mission, setMission] = useState<AutonomousMission | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loadingMission, setLoadingMission] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const authBusy = loading || claimsLoading;
  const selectedChapter = CHAPTERS.find((item) => item.value === chapter) || CHAPTERS[0];

  const plan = mission?.study_plan || mission?.result?.data?.study_plan || [];
  const question = mission?.diagnostic_question || mission?.result?.data?.questions?.[0] || null;
  const roadmap = mission?.adaptive_roadmap || mission?.result?.data?.adaptive_roadmap || [];
  const isCorrect = Boolean(question && selectedAnswer === question.correct);
  const report = useMemo(() => (mission && submitted ? buildReport(mission, isCorrect) : null), [isCorrect, mission, submitted]);

  const startMission = async () => {
    if (!userId || authBusy || loadingMission) return;
    setLoadingMission(true);
    setError("");
    setSubmitted(false);
    setSelectedAnswer("");

    try {
      const res = await fetch(`${backendURL}/coach/autonomous-study/${userId}`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          current_topic: topic,
          current_chapter: chapter,
          subject: "Chemistry",
        }),
      });

      if (!res.ok) throw new Error(`Mission failed: ${res.status}`);
      const data = (await res.json()) as AutonomousMission;
      setMission(data);
    } catch {
      setError("Mission could not start. Please try again.");
    } finally {
      setLoadingMission(false);
    }
  };

  const submitAnswer = async () => {
    if (!question || !selectedAnswer || submitted) return;
    setSubmitted(true);

    if (!userId || !mission) return;
    setSaving(true);
    try {
      await fetch(`${backendURL}/submit-session`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          user_id: userId,
          topic: mission.target_topic,
          subject: mission.subject || "Chemistry",
          score: isCorrect ? 1 : 0,
          total_questions: 1,
          xp_earned: isCorrect ? 10 : 0,
          time_spent_seconds: 60,
          focus_score: selectedAnswer ? 90 : 0,
          session_type: "autonomous_mission",
          replay_data: {
            topic: mission.target_topic,
            source: "autonomous_mission",
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
      });
    } catch {
      setError("Answer saved locally in the mission, but the session could not be logged.");
    } finally {
      setSaving(false);
    }
  };

  if (authBusy) {
    return (
      <div className="flex min-h-[70svh] items-center justify-center text-sm text-[#0E7490]">
        Preparing Mission...
      </div>
    );
  }

  return (
    <div className="mx-auto grid min-h-[calc(100svh-105px)] w-full max-w-7xl gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0E7490]">Autonomous Mission</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          One clear plan. One smart question.
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          This workspace keeps the mission small and motivating: understand the topic, answer one diagnostic, then follow the adaptive roadmap.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <select
            value={chapter}
            onChange={(event) => {
              const next = event.target.value;
              setChapter(next);
              setTopic(CHAPTERS.find((item) => item.value === next)?.topics[0]?.value || "alkanes");
            }}
            className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#0E7490]"
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
            className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#0E7490]"
          >
            {selectedChapter.topics.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={startMission}
          disabled={loadingMission || !userId}
          className="mt-5 w-full rounded-2xl bg-[linear-gradient(135deg,#0F172A,#0E7490,#14B8A6)] px-5 py-4 text-sm font-semibold text-white shadow-[0_20px_55px_rgba(14,116,144,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingMission ? "Building mission..." : mission ? "Refresh mission" : "Start mission"}
        </button>

        {error ? <p className="mt-3 text-sm text-rose-500">{error}</p> : null}

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Guidance</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>1. Read the plan slowly.</p>
            <p>2. Answer the diagnostic honestly.</p>
            <p>3. Follow the personalized next step.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
        {!mission ? (
          <div className="flex min-h-[calc(100svh-255px)] flex-col items-center justify-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-[#0E7490]/10 text-2xl font-bold text-[#0E7490]">
              M
            </div>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
              Start with a tiny win
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
              Students improve faster when the next action is obvious. This mission gives only one diagnostic question, then adapts.
            </p>
          </div>
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
                </div>
                <div className="rounded-2xl bg-[#0E7490]/10 px-4 py-3 text-sm font-semibold text-[#0E7490]">
                  {mission.estimated_minutes || 15} min
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
                        key={option}
                        onClick={() => !submitted && setSelectedAnswer(option)}
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
                <button
                  onClick={submitAnswer}
                  disabled={!selectedAnswer || submitted}
                  className="mt-5 rounded-2xl bg-[#0E7490] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0B5F76] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {submitted ? saving ? "Saving..." : "Submitted" : "Check answer"}
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
          </div>
        )}
      </section>
    </div>
  );
}
