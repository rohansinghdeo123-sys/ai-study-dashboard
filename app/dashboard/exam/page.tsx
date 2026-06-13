"use client";

import { EmptyState, LoadingState } from "@/components/ui/Polished";
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

export default function ExamModePage() {
  const { userId, loading, getAuthHeaders } = useAuth();
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
          timeoutMs: 24000,
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
          timeoutMs: 24000,
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
    <div className="dashboard-overview exam-mode-page mx-auto w-full max-w-[1180px]">
      <header className="exam-mode-header">
        <div>
          <nav aria-label="Breadcrumb" className="dashboard-breadcrumb">
            <Link href="/dashboard">Learning Hub</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Exam Mode</span>
          </nav>
          <p className="dashboard-section-kicker">Focused Assessment</p>
          <h1>Exam Mode</h1>
          <p>Generate course-grounded MCQs and probable theory questions, submit once, then review every mistake.</p>
        </div>
        <div className="exam-mode-status">
          <span>Status</span>
          <strong>{statusLabel}</strong>
          <small>{selectedChapter.label} / {selectedTopic.label}</small>
        </div>
      </header>

      <section className="exam-mode-setup" aria-label="Exam setup">
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
        <button type="button" onClick={() => void generateExamPack()} disabled={generating} className="exam-mode-primary">
          {generating ? "Generating pack..." : questions.length ? "Regenerate exam pack" : "Generate exam pack"}
        </button>
      </section>

      <div className="exam-mode-progress" aria-label={`${completion}% of questions answered`}>
        <span style={{ width: `${completion}%` }} />
      </div>

      {error ? <div className="exam-mode-alert" role="status">{error}</div> : null}

      <section className="exam-mode-workspace">
        <div className="exam-mode-tabs" role="tablist" aria-label="Exam sections">
          {([
            ["mcq", "MCQ Test"],
            ["probable", "Probable Questions"],
            ["review", "Review"],
          ] as Array<[ExamPanel, string]>).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activePanel === id}
              onClick={() => setActivePanel(id)}
              className={activePanel === id ? "is-active" : ""}
            >
              {label}
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
              <EmptyState
                icon="check"
                title="Your exam pack is ready to be created"
                detail="Choose a chapter and topic. AgentifyAI will build five questions only from the connected study material."
              />
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
    </div>
  );
}
