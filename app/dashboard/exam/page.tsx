"use client";

import { AppIcon, EmptyState, LoadingState, type AppIconName } from "@/components/ui/Polished";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, invalidateApiCache } from "@/lib/apiClient";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

type ExamPanel = "mcq" | "probable" | "review";

type ExamQuestion = {
  id: string;
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  source?: string;
};

type ProbableQuestion = {
  id: string;
  marks: number;
  question: string;
  source?: string;
};

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
    label: "Basic Concepts of Chemistry",
    value: "matter",
    topics: [
      { label: "Definition of Chemistry", value: "chemistry_definition" },
      { label: "Alchemy and Iatrochemistry", value: "historical_alchemy" },
      { label: "Ancient Indian Chemistry", value: "ancient_indian_chemistry" },
      { label: "Role and Importance of Chemistry", value: "importance_of_chemistry" },
      { label: "Matter Definition", value: "matter_definition" },
      { label: "Properties of Matter", value: "properties_of_matter" },
      { label: "States of Matter", value: "states_of_matter" },
      { label: "Solid State", value: "solid_state" },
      { label: "Liquid State", value: "liquid_state" },
      { label: "Gaseous State", value: "gaseous_state" },
      { label: "Interconversion of States", value: "interconversion_of_states" },
      { label: "Classification of Matter", value: "classification_of_matter" },
    ],
  },
];

const EXAM_GUARDRAIL = [
  "Use only the uploaded or ingested study material and selected course context.",
  "Do not use outside knowledge, generic model memory, or guesses.",
  "Every MCQ must have exactly four options, one correct answer, a clear explanation, and a traceable source.",
  "If the material is insufficient, return an explicit material-not-found error instead of inventing content.",
].join(" ");

const MATERIAL_NOT_FOUND_MESSAGE = "I could not find this in your study material. Please upload or select the correct chapter/data.";

function normalizeTopicValue(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function findChapterValueForTopic(topicValue: string) {
  const normalizedTopic = normalizeTopicValue(topicValue);
  return CHAPTERS.find((chapter) => chapter.topics.some((topic) => topic.value === normalizedTopic))?.value || "";
}

function isBackendFailureText(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return true;
  return [
    "knowledge base error",
    "not found in any knowledge source",
    "ai service encountered an error",
    "no response generated",
    "option unavailable",
    "not enough context",
    "insufficient context",
    "not present in the data",
    "not in your study material",
    "could not find this in your study material",
  ].some((marker) => text.includes(marker));
}

function normalizeCorrectOption(correctValue: unknown, options: string[]) {
  const correct = String(correctValue || "").trim();
  const letter = correct.slice(0, 1).toUpperCase();
  if (/^[A-D]$/.test(letter)) return letter;
  const index = options.findIndex((option) => option.trim().toLowerCase() === correct.toLowerCase());
  return index >= 0 ? String.fromCharCode(65 + index) : "";
}

function normalizeExamQuestion(raw: unknown, index: number, fallbackSource: string): ExamQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const question = String(record.question || record.text || "").trim();
  const options = Array.isArray(record.options)
    ? record.options.map((option) => String(option || "").trim()).filter(Boolean).slice(0, 4)
    : [];
  const correct = normalizeCorrectOption(record.correct ?? record.correct_answer ?? record.answer, options);
  const explanation = String(record.explanation || record.ai_explanation || "").trim();
  const source = String(record.source || record.reference || record.topic || record.section_id || fallbackSource).trim();

  if (!question || options.length !== 4 || !correct || !explanation) return null;
  if (isBackendFailureText(question) || isBackendFailureText(explanation) || options.some(isBackendFailureText)) return null;

  return {
    id: String(record.id || `Q${index + 1}`),
    question,
    options,
    correct,
    explanation,
    source,
  };
}

function normalizeProbableQuestion(raw: unknown, index: number, fallbackSource: string): ProbableQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const question = String(record.question || record.text || "").trim();
  if (!question || isBackendFailureText(question)) return null;
  return {
    id: String(record.id || `P${index + 1}`),
    marks: Number(record.marks || (index < 2 ? 3 : 5)),
    question,
    source: String(record.source || record.reference || record.topic || record.section_id || fallbackSource).trim(),
  };
}

function clampMetric(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ExamReadinessStrip({
  hasPack,
  answeredCount,
  totalQuestions,
  submitted,
  probableCount,
}: {
  hasPack: boolean;
  answeredCount: number;
  totalQuestions: number;
  submitted: boolean;
  probableCount: number;
}) {
  const items: Array<{
    label: string;
    value: string;
    detail: string;
    icon: AppIconName;
    active: boolean;
    complete: boolean;
  }> = [
    {
      label: "Pack",
      value: hasPack ? "Ready" : "Pending",
      detail: hasPack ? `${totalQuestions} MCQs generated` : "Generate from selected material",
      icon: "book",
      active: hasPack,
      complete: hasPack,
    },
    {
      label: "Attempt",
      value: totalQuestions ? `${answeredCount}/${totalQuestions}` : "0/5",
      detail: submitted ? "Submitted once" : "Answer all questions before review",
      icon: "check",
      active: hasPack && !submitted,
      complete: Boolean(totalQuestions && answeredCount === totalQuestions),
    },
    {
      label: "Review",
      value: submitted ? "Unlocked" : "Locked",
      detail: probableCount ? `${probableCount} theory prompts ready` : "Score and explanations appear here",
      icon: "analytics",
      active: submitted,
      complete: submitted,
    },
  ];

  return (
    <section className="exam-readiness-strip" aria-label="Exam readiness">
      {items.map((item) => (
        <article
          key={item.label}
          className="exam-readiness-card"
          data-active={item.active ? "true" : "false"}
          data-complete={item.complete ? "true" : "false"}
        >
          <span className="exam-readiness-icon" aria-hidden="true">
            <AppIcon name={item.complete ? "check" : item.icon} />
          </span>
          <div>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </div>
        </article>
      ))}
    </section>
  );
}

export default function ExamModePage() {
  const { profile, userId, loading, getAuthHeaders } = useAuth();
  const searchParams = useSearchParams();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  const initialTopic = searchParams.get("topic") || "alkanes";
  const initialChapter = searchParams.get("chapter") || findChapterValueForTopic(initialTopic) || "hydrocarbon";

  const [chapter, setChapter] = useState(initialChapter);
  const [topic, setTopic] = useState(initialTopic);
  const [activePanel, setActivePanel] = useState<ExamPanel>("mcq");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [probableQuestions, setProbableQuestions] = useState<ProbableQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [retryCount, setRetryCount] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const startedAtRef = useRef<string | null>(null);
  const generationLatencyRef = useRef(0);
  const answerSelectionsRef = useRef<Record<string, string>>({});

  const selectedChapter = CHAPTERS.find((item) => item.value === chapter) || CHAPTERS[0];
  const selectedTopic = selectedChapter.topics.find((item) => item.value === topic) || selectedChapter.topics[0];
  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const score = questions.reduce((total, question) => total + (answers[question.id] === question.correct ? 1 : 0), 0);
  const completion = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const threeMarkQuestions = probableQuestions.filter((question) => question.marks !== 5);
  const fiveMarkQuestions = probableQuestions.filter((question) => question.marks === 5);
  const accuracy = submitted && questions.length ? Math.round((score / questions.length) * 100) : 0;
  const targetQuestionCount = questions.length || 5;
  const studyHref = `/dashboard/study?chapter=${encodeURIComponent(selectedChapter.value)}&topic=${encodeURIComponent(selectedTopic.value)}`;
  const packPhase = generating
    ? "Generating"
    : submitted
      ? "Review ready"
      : questions.length
        ? "Attempt active"
        : "Pack blueprint";
  const packIntent = questions.length
    ? "Finish the MCQ attempt, submit once, then use review to repair mistakes."
    : "Build a source-locked five-question pack from the selected chapter and topic.";
  const briefMetrics = [
    { label: "MCQs", value: `${targetQuestionCount}`, detail: questions.length ? "Generated" : "Planned" },
    { label: "Answered", value: `${answeredCount}/${targetQuestionCount}`, detail: submitted ? "Locked" : "In progress" },
    { label: "Theory", value: `${probableQuestions.length || 3}+`, detail: probableQuestions.length ? "Ready" : "After generation" },
    { label: "Score", value: submitted ? `${accuracy}%` : "--", detail: submitted ? `${score * 10} XP` : "After submit" },
  ];
  const launchChecklist = [
    { label: "Course locked", detail: `${selectedChapter.label} / ${selectedTopic.label}` },
    { label: "Grounded only", detail: "No outside knowledge or guesses allowed" },
    { label: "Review loop", detail: "Explanations unlock after one complete submission" },
  ];

  const statusLabel = useMemo(() => {
    if (generating) return "Building a grounded exam pack";
    if (submitted) return `${score}/${questions.length} correct`;
    if (questions.length) return `${answeredCount}/${questions.length} answered`;
    return "Ready when you are";
  }, [answeredCount, generating, questions.length, score, submitted]);

  const resetAttempt = () => {
    setQuestions([]);
    setProbableQuestions([]);
    setAnswers({});
    setRetryCount(0);
    setSubmitted(false);
    setError("");
    setActivePanel("mcq");
    answerSelectionsRef.current = {};
    startedAtRef.current = null;
    generationLatencyRef.current = 0;
  };

  const generateExamPack = async () => {
    if (!userId || generating) return;
    const requestStartedAt = Date.now();
    resetAttempt();
    setGenerating(true);

    try {
      const headers = await getAuthHeaders();
      const sessionSeed = `${userId}-${selectedTopic.value}-${Date.now()}`;
      const [mcqResult, probableResult] = await Promise.allSettled([
        apiFetch(`${backendURL}/generate-mcqs`, {
          method: "POST",
          headers,
          timeoutMs: 45000,
          retries: 1,
          body: JSON.stringify({
            topic: selectedTopic.label,
            section_id: selectedTopic.value,
            session_id: `exam-${sessionSeed}`,
            difficulty: "medium",
            count: 5,
            subject: "Chemistry",
            chapter: selectedChapter.label,
            strict_grounding: true,
            retrieval_required: true,
            fallback_to_general_knowledge: false,
            include_source: true,
            require_four_options: true,
            require_explanation: true,
            system_guardrail: EXAM_GUARDRAIL,
            required_not_found_response: MATERIAL_NOT_FOUND_MESSAGE,
          }),
        }),
        apiFetch(`${backendURL}/generate-probable-questions`, {
          method: "POST",
          headers,
          timeoutMs: 45000,
          retries: 1,
          body: JSON.stringify({
            topic: selectedTopic.label,
            section_id: selectedTopic.value,
            session_id: `probable-${sessionSeed}`,
            difficulty: "medium",
            subject: "Chemistry",
            chapter: selectedChapter.label,
            strict_grounding: true,
            retrieval_required: true,
            fallback_to_general_knowledge: false,
            include_source: true,
            system_guardrail: EXAM_GUARDRAIL,
            required_not_found_response: MATERIAL_NOT_FOUND_MESSAGE,
          }),
        }),
      ]);

      const mcqResponse = mcqResult.status === "fulfilled" ? mcqResult.value : null;
      const probableResponse = probableResult.status === "fulfilled" ? probableResult.value : null;
      if (!mcqResponse?.ok) throw new Error("MCQ generation failed");

      const mcqData = await mcqResponse.json().catch(() => null);
      const probableData = probableResponse?.ok ? await probableResponse.json().catch(() => null) : null;
      const sourceLabel = `${selectedChapter.label} / ${selectedTopic.label}`;
      const nextQuestions = Array.isArray(mcqData?.questions)
        ? mcqData.questions
            .map((question: unknown, index: number) => normalizeExamQuestion(question, index, sourceLabel))
            .filter((question: ExamQuestion | null): question is ExamQuestion => Boolean(question))
        : [];
      const nextProbable = Array.isArray(probableData?.questions)
        ? probableData.questions
            .map((question: unknown, index: number) => normalizeProbableQuestion(question, index, sourceLabel))
            .filter((question: ProbableQuestion | null): question is ProbableQuestion => Boolean(question))
        : [];

      if (nextQuestions.length < 5) {
        setError(String(mcqData?.error || "A complete five-question pack could not be created from this material. Try another topic or regenerate."));
        return;
      }

      setQuestions(nextQuestions.slice(0, 5));
      setProbableQuestions(nextProbable);
      startedAtRef.current = new Date().toISOString();
      generationLatencyRef.current = Date.now() - requestStartedAt;
      if (nextProbable.length < 3) {
        setError("Your MCQ pack is ready. Probable questions are temporarily limited for this topic.");
      }
    } catch {
      setError("The exam pack could not be generated right now. Please retry after checking the selected study material.");
    } finally {
      setGenerating(false);
    }
  };

  const recordAnswer = (questionId: string, option: string) => {
    if (submitted) return;
    const previous = answerSelectionsRef.current[questionId];
    if (previous && previous !== option) setRetryCount((current) => current + 1);
    answerSelectionsRef.current = { ...answerSelectionsRef.current, [questionId]: option };
    setAnswers((current) => ({ ...current, [questionId]: option }));
  };

  const submitExam = async () => {
    if (!questions.length || submitted || !userId) return;
    const completedAt = new Date();
    const startedAt = startedAtRef.current || completedAt.toISOString();
    const startedAtMs = new Date(startedAt).getTime();
    const durationSeconds = Number.isFinite(startedAtMs)
      ? Math.max(1, Math.round((completedAt.getTime() - startedAtMs) / 1000))
      : 1;
    const scorePercent = Math.round((score / questions.length) * 100);
    const focusScore = clampMetric(scorePercent - Math.min(20, retryCount * 3));

    setSubmitted(true);
    setActivePanel("review");
    setSaving(true);
    setError("");

    try {
      await apiFetch(`${backendURL}/submit-session`, {
        method: "POST",
        headers: await getAuthHeaders(),
        retries: 1,
        timeoutMs: 9000,
        body: JSON.stringify({
          user_id: userId,
          topic: selectedTopic.label,
          subject: "Chemistry",
          score,
          total_questions: questions.length,
          xp_earned: score * 10,
          time_spent_seconds: durationSeconds,
          focus_score: focusScore,
          session_type: "study_exam",
          started_at: startedAt,
          completed_at: completedAt.toISOString(),
          response_latency_ms: generationLatencyRef.current,
          hint_count: 0,
          retry_count: retryCount,
          replay_data: {
            topic: selectedTopic.label,
            source: "exam_mode",
            telemetry: {
              started_at: startedAt,
              completed_at: completedAt.toISOString(),
              duration_seconds: durationSeconds,
              exam_generation_latency_ms: generationLatencyRef.current,
              retry_count: retryCount,
              focus_score: focusScore,
            },
            questions: questions.map((question) => ({
              id: question.id,
              text: question.question,
              topic: selectedTopic.label,
              options: question.options,
              correct_answer: question.correct,
              user_answer: answers[question.id] || "",
              is_correct: answers[question.id] === question.correct,
              ai_explanation: question.explanation,
            })),
            probable_questions: probableQuestions,
          },
        }),
      });
      invalidateApiCache(`sessions:${userId}`);
      invalidateApiCache(`progress:${userId}`);
      invalidateApiCache("leaderboard");
    } catch {
      setError("Your review is ready, but this result could not be saved. Please keep this page open and retry with a new pack later.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState title="Opening Exam Mode..." detail="Preparing your grounded assessment workspace." />;
  }

  return (
    <div className="dashboard-overview exam-mode-page w-full">
      <section className="exam-command-hero">
        <header className="exam-mode-header">
          <div>
            <nav aria-label="Breadcrumb" className="dashboard-breadcrumb">
              <Link href="/dashboard">Learning Hub</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Exam Mode</span>
            </nav>
            <p className="dashboard-section-kicker">
              Focused Assessment{profile?.classLevel ? ` / ${profile.classLevel}` : ""}
            </p>
            <h1>Exam command center</h1>
            <p>Generate course-grounded MCQs and probable theory questions, submit once, then review every mistake with a clean repair loop.</p>
          </div>
          <div className="exam-mode-status">
            <span>Status</span>
            <strong>{statusLabel}</strong>
            <small>{selectedChapter.label} / {selectedTopic.label}</small>
          </div>
        </header>

        <aside className="exam-hero-brief" aria-label="Exam pack brief">
          <div className="exam-hero-brief-top">
            <span className="exam-hero-icon" aria-hidden="true">
              <AppIcon name={generating ? "clock" : submitted ? "analytics" : questions.length ? "check" : "book"} />
            </span>
            <div>
              <p>Current phase</p>
              <strong>{packPhase}</strong>
            </div>
          </div>
          <p className="exam-hero-brief-copy">{packIntent}</p>
          <div className="exam-brief-metrics">
            {briefMetrics.map((metric) => (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <div className="exam-mode-layout">
        <main className="exam-mode-main">
          <section className="exam-mode-setup" aria-label="Exam setup">
            <div className="exam-mode-builder-copy">
              <p>Build pack</p>
              <strong>{selectedTopic.label}</strong>
              <span>Source locked to {selectedChapter.label}</span>
            </div>
            <div className="exam-mode-selectors">
              <label>
                <span>Chapter</span>
                <select
                  value={selectedChapter.value}
                  onChange={(event) => {
                    const nextChapter = event.target.value;
                    setChapter(nextChapter);
                    setTopic(CHAPTERS.find((item) => item.value === nextChapter)?.topics[0]?.value || "alkanes");
                    resetAttempt();
                  }}
                >
                  {CHAPTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label>
                <span>Topic</span>
                <select
                  value={selectedTopic.value}
                  onChange={(event) => {
                    setTopic(event.target.value);
                    resetAttempt();
                  }}
                >
                  {selectedChapter.topics.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
            </div>
            <button type="button" onClick={() => void generateExamPack()} disabled={generating || !userId} className="exam-mode-primary">
              {generating ? "Generating pack..." : questions.length ? "Regenerate exam pack" : "Generate exam pack"}
            </button>
          </section>

          <ExamReadinessStrip
            hasPack={Boolean(questions.length)}
            answeredCount={answeredCount}
            totalQuestions={targetQuestionCount}
            submitted={submitted}
            probableCount={probableQuestions.length}
          />

          <div className="exam-mode-progress" aria-label={`${completion}% of questions answered`}>
            <span style={{ width: `${completion}%` }} />
          </div>

          {error ? <div className="exam-mode-alert" role="status">{error}</div> : null}

          <section className="exam-mode-workspace">
        <div className="exam-mode-tabs" role="tablist" aria-label="Exam sections">
          {([
            ["mcq", "MCQ Test", `${targetQuestionCount}`],
            ["probable", "Probable Questions", probableQuestions.length ? `${probableQuestions.length}` : "Soon"],
            ["review", "Review", submitted ? `${score}/${questions.length}` : "Locked"],
          ] as Array<[ExamPanel, string, string]>).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activePanel === id}
              onClick={() => setActivePanel(id)}
              className={activePanel === id ? "is-active" : ""}
            >
              <span>{label}</span>
              <small>{count}</small>
            </button>
          ))}
        </div>

        <div className="exam-mode-content">
          {activePanel === "mcq" ? (
            generating ? (
              <LoadingState title="Creating five grounded questions..." detail="Checking options, explanations, and textbook sources." />
            ) : questions.length ? (
              <>
                <div className="exam-question-list">
                  {questions.map((question, index) => {
                    const selected = answers[question.id];
                    return (
                      <article key={question.id} className="exam-question-card">
                        <div className="exam-question-number">{index + 1}</div>
                        <div className="min-w-0">
                          <h2>{question.question}</h2>
                          {question.source ? <p className="exam-question-source">Source: {question.source}</p> : null}
                          <div className="exam-options">
                            {question.options.map((option, optionIndex) => {
                              const optionKey = String.fromCharCode(65 + optionIndex);
                              const isSelected = selected === optionKey;
                              return (
                                <button
                                  key={`${question.id}-${optionKey}`}
                                  type="button"
                                  disabled={submitted}
                                  data-selected={isSelected ? "true" : "false"}
                                  onClick={() => recordAnswer(question.id, optionKey)}
                                >
                                  <strong>{optionKey}</strong>
                                  <span>{option.replace(/^[A-D][.)]\s*/i, "")}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <div className="exam-submit-row">
                  <p>{answeredCount} of {questions.length} answered</p>
                  <button
                    type="button"
                    onClick={() => void submitExam()}
                    disabled={submitted || answeredCount !== questions.length || saving}
                    className="exam-mode-primary"
                  >
                    {saving ? "Saving result..." : submitted ? "Submitted" : "Submit and review"}
                  </button>
                </div>
              </>
            ) : (
              <div className="exam-launch-state">
                <div className="exam-launch-copy">
                  <span className="exam-launch-icon" aria-hidden="true">
                    <AppIcon name="spark" />
                  </span>
                  <p className="dashboard-section-kicker">Source-locked assessment</p>
                  <h2>Build a five-question pack from {selectedTopic.label}.</h2>
                  <p>
                    AgentifyAI will create MCQs, probable theory prompts, explanations, and source traces from the connected study material only.
                  </p>
                  <div className="exam-launch-actions">
                    <button type="button" onClick={() => void generateExamPack()} disabled={generating || !userId} className="exam-mode-primary">
                      Generate exam pack
                    </button>
                    <Link href={studyHref} className="exam-mode-secondary">
                      Revise topic first
                    </Link>
                  </div>
                </div>
                <div className="exam-launch-checklist">
                  {launchChecklist.map((item) => (
                    <article key={item.label}>
                      <span aria-hidden="true"><AppIcon name="check" /></span>
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.detail}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )
          ) : null}

          {activePanel === "probable" ? (
            probableQuestions.length ? (
              <div className="exam-probable-grid">
                {[
                  ["3-mark questions", threeMarkQuestions],
                  ["5-mark questions", fiveMarkQuestions],
                ].map(([label, items]) => (
                  <section key={String(label)} className="exam-probable-card">
                    <p className="dashboard-section-kicker">{String(label)}</p>
                    <div>
                      {(items as ProbableQuestion[]).map((question) => (
                        <article key={question.id}>
                          <h2>{question.question}</h2>
                          {question.source ? <p>Source: {question.source}</p> : null}
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="book"
                title="No probable questions yet"
                detail="Generate an exam pack to prepare likely theory questions from this chapter."
              />
            )
          ) : null}

          {activePanel === "review" ? (
            submitted ? (
              <div className="exam-review-layout">
                <section className="exam-score-card">
                  <span>Final score</span>
                  <strong>{score}/{questions.length}</strong>
                  <p>{accuracy}% accuracy / {score * 10} XP earned</p>
                </section>
                <div className="exam-review-list">
                  {questions.map((question, index) => {
                    const selected = answers[question.id] || "Not answered";
                    const correct = selected === question.correct;
                    return (
                      <article key={`review-${question.id}`} data-correct={correct ? "true" : "false"}>
                        <span>{correct ? "Correct" : `Question ${index + 1} needs review`}</span>
                        <h2>{question.question}</h2>
                        <p>Your answer: {selected}. Correct answer: {question.correct}.</p>
                        <p>{question.explanation}</p>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState
                icon="analytics"
                title="Submit the MCQ test to unlock review"
                detail="Your score, XP, explanations, and mistakes will appear here after one complete submission."
              />
            )
          ) : null}
        </div>
          </section>
        </main>

        <aside className="exam-mode-brief-rail" aria-label="Exam guidance">
          <section className="exam-brief-panel">
            <p className="dashboard-section-kicker">Exam brief</p>
            <h2>{selectedTopic.label}</h2>
            <p>Keep the attempt tight: generate, answer all five, submit once, then fix every miss from the review tab.</p>
            <div className="exam-brief-topic">
              <span>Chapter</span>
              <strong>{selectedChapter.label}</strong>
            </div>
            <div className="exam-brief-topic">
              <span>Topic</span>
              <strong>{selectedTopic.label}</strong>
            </div>
          </section>

          <section className="exam-brief-panel">
            <p className="dashboard-section-kicker">Grounding rules</p>
            <div className="exam-brief-list">
              {[
                "Only selected study material is allowed.",
                "Each MCQ needs four options and one answer.",
                "Material gaps must show an explicit not-found message.",
              ].map((item) => (
                <div key={item}>
                  <AppIcon name="check" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="exam-brief-panel">
            <p className="dashboard-section-kicker">Quick actions</p>
            <div className="exam-brief-actions">
              <button type="button" onClick={() => setActivePanel("mcq")}>Open MCQs</button>
              <button type="button" onClick={() => setActivePanel("probable")}>Theory prompts</button>
              <Link href={studyHref}>Revise in Study</Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
