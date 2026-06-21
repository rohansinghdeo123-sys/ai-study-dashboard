"use client";

import { AppIcon, EmptyState, LoadingState, type AppIconName } from "@/components/ui/Polished";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, invalidateApiCache } from "@/lib/apiClient";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, type ChangeEvent } from "react";

type ExamPanel = "mcq" | "papers" | "probable" | "practice";
type ParseStatus = "pending" | "analyzed" | "analyzed_empty" | "needs_ocr" | "failed";
type Priority = "high" | "medium" | "low";
type EvaluationStatus = "awaiting_answer" | "evaluating" | "evaluated";
type GenerationMode = "mixed" | "chapter_wise" | "marks_wise" | "section_wise";
type ProbableMode = "syllabus" | "paper_pattern";

type ExamQuestion = {
  id: string;
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  source?: string;
};

type LegacyProbableQuestion = {
  id: string;
  marks: number | null;
  question: string;
  source?: string;
};

type PaperOut = {
  id: number;
  class_level: string;
  subject: string;
  chapter_id: number | null;
  chapter_name: string;
  exam_type: string;
  paper_title: string;
  file_name: string;
  file_type: string;
  file_size: number;
  upload_status: string;
  parse_status: ParseStatus;
  uploaded_at: string | null;
  parsed_at: string | null;
  extraction_confidence: number;
  extracted_question_count: number;
  warnings: string[];
  created_at: string | null;
  updated_at: string | null;
};

type PaperAnalysis = {
  total_questions: number;
  total_marks: number | null;
  section_breakdown: Record<string, { questions: number; marks: number | null }>;
  marks_distribution: Record<string, number>;
  question_type_distribution: Record<string, number>;
  difficulty_distribution: Record<string, number>;
  topic_frequency: Record<string, number>;
  repeated_concepts: string[];
  high_frequency_concepts: string[];
  chapter_weightage: Record<string, string | number>;
  short_vs_long: Record<string, number>;
  pattern_style: string;
  pattern_summary: string;
  warnings: string[];
};

type ExtractedQuestion = {
  id: number;
  paper_id: number;
  question_number: string;
  section_name: string;
  question_text: string;
  marks: number | null;
  question_type: string;
  intent: string;
  difficulty: string;
  topic: string;
  concept_tags: string[];
  expected_answer_style: string;
  confidence_score: number;
};

type PaperUploadResponse = {
  paper: PaperOut;
  analysis: PaperAnalysis;
  questions_extracted: number;
  warnings: string[];
  message: string;
};

type PatternAnalysis = {
  id: number;
  class_level: string;
  subject: string;
  chapter_id: number | null;
  chapter_name: string;
  source_paper_ids: number[];
  total_questions: number;
  total_marks: number | null;
  marks_distribution: Record<string, number>;
  question_type_distribution: Record<string, number>;
  chapter_weightage: Record<string, string | number>;
  topic_frequency: Record<string, number>;
  repeated_concepts: string[];
  difficulty_distribution: Record<string, number>;
  pattern_summary: string;
  confidence_score: number;
  created_at: string | null;
  updated_at: string | null;
};

type PatternSummary = {
  papers_total: number;
  papers_analyzed: number;
  subjects: string[];
  latest_analysis: PatternAnalysis | null;
  analyses: PatternAnalysis[];
};

type PatternProbableQuestion = {
  id: string;
  question: string;
  marks: number | null;
  question_type: string;
  intent: string;
  topic: string;
  priority: Priority;
  based_on: string;
  source: string;
};

type ProbableQuestionSet = {
  id: number;
  class_level: string;
  subject: string;
  chapter_id: number | null;
  chapter_name: string;
  source_analysis_ids: number[];
  generation_mode: GenerationMode | string;
  probable_questions: PatternProbableQuestion[];
  priority_topics: { topic: string; reason: string; weight: Priority }[];
  strategy_summary: string;
  disclaimer: string;
  confidence_score: number;
  created_at: string | null;
};

type WrittenSession = {
  id: number;
  class_level: string;
  subject: string;
  chapter_id: number | null;
  chapter_name: string;
  topic: string;
  marks_focus: string | null;
  session_status: string;
  started_at: string | null;
  completed_at: string | null;
  attempt_count: number;
};

type WrittenQuestion = {
  attempt_id: number;
  session_id: number;
  question_text: string;
  question_type: string;
  marks_total: number;
  topic: string;
  command_word: string;
  evaluation_status: EvaluationStatus;
};

type WrittenFeedback = {
  attempt_id: number;
  question_text: string;
  question_type: string;
  student_answer: string;
  marks_awarded: number;
  marks_total: number;
  score_percentage: number;
  covered_points: string[];
  missing_points: string[];
  incorrect_points: string[];
  weak_explanation: string[];
  presentation_feedback: string;
  teacher_feedback: string;
  model_answer: string;
  improve_to_full_marks: string;
  rubric_scores: Record<string, number>;
  next_question_suggestion: string;
  created_at: string | null;
};

type AttemptSummary = {
  id: number;
  session_id: number;
  question_text: string;
  question_type: string;
  marks_total: number;
  marks_awarded: number | null;
  score_percentage: number | null;
  evaluation_status: EvaluationStatus;
  topic: string;
  subject: string;
  submitted_at: string | null;
  created_at: string | null;
};

type Weakness = {
  id: number;
  class_level: string;
  subject: string;
  chapter_id: number | null;
  chapter_name: string;
  topic: string;
  weakness_type: string;
  weakness_summary: string;
  evidence: string[];
  frequency_count: number;
  last_seen_at: string | null;
  improvement_suggestion: string;
  created_at: string | null;
  updated_at: string | null;
};

type WeaknessTopic = {
  topic: string;
  subject: string;
  total_frequency: number;
  weakness_types: string[];
  latest_suggestion: string;
};

const SUBJECT = "Chemistry";
const DEFAULT_CLASS_LEVEL = "Class 11";
const EMPTY_VALUE = "--";

const CHAPTERS = [
  {
    label: "Hydrocarbons",
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

const EXAM_TYPES = [
  { value: "unit_test", label: "Unit test" },
  { value: "class_test", label: "Class test" },
  { value: "school_exam", label: "School exam" },
  { value: "pre_board", label: "Pre-board" },
  { value: "board_exam", label: "Board exam" },
  { value: "chapter_wise", label: "Chapter-wise" },
  { value: "subject_wise", label: "Subject-wise" },
  { value: "other", label: "Other" },
];

const QUESTION_TYPES = [
  { value: "long_answer", label: "Long answer" },
  { value: "short_answer", label: "Short answer" },
  { value: "numerical", label: "Numerical" },
  { value: "diagram", label: "Diagram" },
  { value: "case_based", label: "Case based" },
];

const GENERATION_MODES: Array<{ value: GenerationMode; label: string }> = [
  { value: "mixed", label: "Mixed" },
  { value: "chapter_wise", label: "Chapter-wise" },
  { value: "marks_wise", label: "Marks-wise" },
  { value: "section_wise", label: "Section-wise" },
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

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function normalizeLegacyProbableQuestion(raw: unknown, index: number, fallbackSource: string): LegacyProbableQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const question = String(record.question || record.text || "").trim();
  if (!question || isBackendFailureText(question)) return null;
  return {
    id: String(record.id || `P${index + 1}`),
    marks: record.marks == null ? (index < 2 ? 3 : 5) : toNumber(record.marks, index < 2 ? 3 : 5),
    question,
    source: String(record.source || record.reference || record.topic || record.section_id || fallbackSource).trim(),
  };
}

function clampMetric(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return EMPTY_VALUE;
  return String(value);
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return EMPTY_VALUE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMarks(value: number | null | undefined) {
  return value === null || value === undefined ? EMPTY_VALUE : String(value);
}

function formatConfidence(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return EMPTY_VALUE;
  const numeric = Number(value);
  return `${Math.round((numeric <= 1 ? numeric * 100 : numeric))}%`;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return EMPTY_VALUE;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getRecordEntries(record: Record<string, string | number> | Record<string, number> | undefined) {
  return Object.entries(record || {})
    .map(([key, value]) => ({ key, value }))
    .sort((first, second) => toNumber(second.value) - toNumber(first.value));
}

async function readResponseJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data
        ? String((data as { detail?: unknown }).detail || "")
        : "";
    const retryAfter = response.headers.get("Retry-After");
    const quotaHint = response.status === 429 && retryAfter ? ` Retry after ${retryAfter}s.` : "";
    throw new Error(detail || `${response.status} request failed.${quotaHint}`);
  }
  return data as T;
}

function removeContentType(headers: HeadersInit) {
  const next = new Headers(headers);
  next.delete("Content-Type");
  next.delete("content-type");
  return next;
}

function DistributionList({
  title,
  data,
  suffix = "",
}: {
  title: string;
  data: Record<string, string | number> | Record<string, number> | undefined;
  suffix?: string;
}) {
  const entries = getRecordEntries(data);
  const max = Math.max(1, ...entries.map((entry) => toNumber(entry.value)));

  return (
    <section className="exam-distribution-card">
      <div className="exam-mini-header">
        <p className="dashboard-section-kicker">{title}</p>
      </div>
      {entries.length ? (
        <div className="exam-distribution-list">
          {entries.slice(0, 7).map((entry) => {
            const numeric = toNumber(entry.value);
            return (
              <div key={entry.key}>
                <span>{formatLabel(entry.key)}</span>
                <strong>{displayValue(entry.value)}{suffix}</strong>
                <i style={{ width: `${Math.max(8, Math.round((numeric / max) * 100))}%` }} />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="exam-muted-copy">No signal yet.</p>
      )}
    </section>
  );
}

function ChipList({ items, empty = "No signal yet." }: { items: string[]; empty?: string }) {
  return items.length ? (
    <div className="exam-chip-list">
      {items.slice(0, 10).map((item) => <span key={item}>{formatLabel(item)}</span>)}
    </div>
  ) : (
    <p className="exam-muted-copy">{empty}</p>
  );
}

function ExamReadinessStrip({
  hasPack,
  answeredCount,
  totalQuestions,
  submitted,
  probableCount,
  papersCount,
  patternReady,
  writtenScore,
}: {
  hasPack: boolean;
  answeredCount: number;
  totalQuestions: number;
  submitted: boolean;
  probableCount: number;
  papersCount: number;
  patternReady: boolean;
  writtenScore: string;
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
      label: "MCQ",
      value: hasPack ? "Ready" : "Pending",
      detail: hasPack ? `${totalQuestions} questions generated` : "Generate from selected material",
      icon: "book",
      active: hasPack,
      complete: hasPack,
    },
    {
      label: "Papers",
      value: `${papersCount}`,
      detail: papersCount ? "Uploaded for pattern work" : "Upload paper PDFs or text",
      icon: "download",
      active: papersCount > 0,
      complete: papersCount > 0,
    },
    {
      label: "Pattern",
      value: patternReady ? "Ready" : "Open",
      detail: patternReady ? "Analysis available" : "Analyze uploaded papers",
      icon: "analytics",
      active: patternReady,
      complete: patternReady,
    },
    {
      label: "Attempt",
      value: totalQuestions ? `${answeredCount}/${totalQuestions}` : "0/5",
      detail: submitted ? "Submitted once" : "Answer all MCQs before review",
      icon: "check",
      active: hasPack && !submitted,
      complete: Boolean(totalQuestions && answeredCount === totalQuestions),
    },
    {
      label: "Written",
      value: writtenScore,
      detail: probableCount ? `${probableCount} prompts ready` : "Teacher feedback after submit",
      icon: "study",
      active: writtenScore !== EMPTY_VALUE,
      complete: writtenScore !== EMPTY_VALUE,
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
  const initialTopic = normalizeTopicValue(searchParams.get("topic") || "alkanes") || "alkanes";
  const initialChapter = searchParams.get("chapter") || findChapterValueForTopic(initialTopic) || "hydrocarbon";

  const [chapter, setChapter] = useState(initialChapter);
  const [topic, setTopic] = useState(initialTopic);
  const [activePanel, setActivePanel] = useState<ExamPanel>("mcq");

  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [legacyProbableQuestions, setLegacyProbableQuestions] = useState<LegacyProbableQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [retryCount, setRetryCount] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [papers, setPapers] = useState<PaperOut[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<number | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<PaperAnalysis | null>(null);
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestion[]>([]);
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [paperTitle, setPaperTitle] = useState("");
  const [examType, setExamType] = useState("unit_test");
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [uploadingPaper, setUploadingPaper] = useState(false);
  const [loadingExtracted, setLoadingExtracted] = useState(false);
  const [reanalyzingPaper, setReanalyzingPaper] = useState(false);

  const [patternAnalysis, setPatternAnalysis] = useState<PatternAnalysis | null>(null);
  const [patternSummary, setPatternSummary] = useState<PatternSummary | null>(null);
  const [analyzingPattern, setAnalyzingPattern] = useState(false);

  const [probableMode, setProbableMode] = useState<ProbableMode>("paper_pattern");
  const [generationMode, setGenerationMode] = useState<GenerationMode>("mixed");
  const [patternQuestionSet, setPatternQuestionSet] = useState<ProbableQuestionSet | null>(null);
  const [generatingPatternProbable, setGeneratingPatternProbable] = useState(false);

  const [writtenSession, setWrittenSession] = useState<WrittenSession | null>(null);
  const [writtenQuestion, setWrittenQuestion] = useState<WrittenQuestion | null>(null);
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [writtenFeedback, setWrittenFeedback] = useState<WrittenFeedback | null>(null);
  const [marksFocus, setMarksFocus] = useState("5");
  const [writtenQuestionType, setWrittenQuestionType] = useState("long_answer");
  const [customQuestionText, setCustomQuestionText] = useState("");
  const [customAnswer, setCustomAnswer] = useState("");
  const [customMarks, setCustomMarks] = useState("5");
  const [startingWritten, setStartingWritten] = useState(false);
  const [generatingWrittenQuestion, setGeneratingWrittenQuestion] = useState(false);
  const [submittingWritten, setSubmittingWritten] = useState(false);
  const [writtenHistory, setWrittenHistory] = useState<AttemptSummary[]>([]);
  const [weaknesses, setWeaknesses] = useState<Weakness[]>([]);
  const [weaknessTopics, setWeaknessTopics] = useState<WeaknessTopic[]>([]);
  const [loadingReviewData, setLoadingReviewData] = useState(false);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const startedAtRef = useRef<string | null>(null);
  const generationLatencyRef = useRef(0);
  const answerSelectionsRef = useRef<Record<string, string>>({});

  const selectedChapter = CHAPTERS.find((item) => item.value === chapter) || CHAPTERS[0];
  const selectedTopic = selectedChapter.topics.find((item) => item.value === topic) || selectedChapter.topics[0];
  const classLevel = profile?.classLevel || DEFAULT_CLASS_LEVEL;
  const analyzedPapers = papers.filter((paper) => paper.parse_status === "analyzed");
  const selectedPaper = selectedPaperId ? papers.find((paper) => paper.id === selectedPaperId) || null : null;
  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const score = questions.reduce((total, question) => total + (answers[question.id] === question.correct ? 1 : 0), 0);
  const completion = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const threeMarkQuestions = legacyProbableQuestions.filter((question) => question.marks !== 5);
  const fiveMarkQuestions = legacyProbableQuestions.filter((question) => question.marks === 5);
  const accuracy = submitted && questions.length ? Math.round((score / questions.length) * 100) : 0;
  const targetQuestionCount = questions.length || 5;
  const studyHref = `/dashboard/study?chapter=${encodeURIComponent(selectedChapter.value)}&topic=${encodeURIComponent(selectedTopic.value)}`;
  const writtenScore = writtenFeedback ? `${formatMarks(writtenFeedback.marks_awarded)}/${formatMarks(writtenFeedback.marks_total)}` : EMPTY_VALUE;

  const packPhase = generating
    ? "Generating"
    : submitted
      ? "Review ready"
      : questions.length
        ? "Attempt active"
        : patternAnalysis
          ? "Pattern ready"
          : "Command center";
  const packIntent = patternAnalysis
    ? patternAnalysis.pattern_summary
    : "Run MCQs, upload papers for pattern intelligence, generate probable questions, and practice written answers in one full-screen workspace.";
  const briefMetrics = [
    { label: "MCQs", value: `${targetQuestionCount}`, detail: questions.length ? "Generated" : "Planned" },
    { label: "Papers", value: `${papers.length}`, detail: analyzedPapers.length ? `${analyzedPapers.length} analyzed` : "Upload ready" },
    { label: "Pattern", value: patternAnalysis ? formatConfidence(patternAnalysis.confidence_score) : EMPTY_VALUE, detail: patternAnalysis ? "Confidence" : "After analysis" },
    { label: "Written", value: writtenScore, detail: writtenFeedback ? "Latest score" : "Practice ready" },
  ];

  const statusLabel = useMemo(() => {
    if (generating) return "Building a grounded MCQ pack";
    if (uploadingPaper) return "Analyzing uploaded paper";
    if (analyzingPattern) return "Reading paper patterns";
    if (generatingWrittenQuestion) return "Preparing written question";
    if (submittingWritten) return "Checking written answer";
    if (submitted) return `${score}/${questions.length} correct`;
    if (questions.length) return `${answeredCount}/${questions.length} answered`;
    return "Ready when you are";
  }, [
    analyzingPattern,
    answeredCount,
    generating,
    generatingWrittenQuestion,
    questions.length,
    score,
    submitted,
    submittingWritten,
    uploadingPaper,
  ]);

  const patternSourceIds = useMemo(() => {
    if (selectedPaperId) return [selectedPaperId];
    return analyzedPapers.map((paper) => paper.id);
  }, [analyzedPapers, selectedPaperId]);

  const resetAttempt = () => {
    setQuestions([]);
    setLegacyProbableQuestions([]);
    setAnswers({});
    setRetryCount(0);
    setSubmitted(false);
    setError("");
    answerSelectionsRef.current = {};
    startedAtRef.current = null;
    generationLatencyRef.current = 0;
  };

  const resetCourseContext = () => {
    resetAttempt();
    setLatestAnalysis(null);
    setExtractedQuestions([]);
    setSelectedPaperId(null);
    setPatternAnalysis(null);
    setPatternQuestionSet(null);
    setWrittenSession(null);
    setWrittenQuestion(null);
    setWrittenAnswer("");
    setWrittenFeedback(null);
    setNotice("");
  };

  const callJson = async <T,>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      timeoutMs?: number;
      retries?: number;
      cacheKey?: string;
    } = {},
  ) => {
    const headers = await getAuthHeaders();
    const response = await apiFetch(`${backendURL}${path}`, {
      method: options.method || "GET",
      headers,
      retries: options.retries ?? 1,
      timeoutMs: options.timeoutMs ?? 18000,
      cacheKey: options.cacheKey,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return readResponseJson<T>(response);
  };

  const loadPapers = async () => {
    if (!userId || loadingPapers) return;
    setLoadingPapers(true);
    try {
      const params = new URLSearchParams({ subject: SUBJECT, limit: "50", offset: "0" });
      const data = await callJson<{ total: number; papers: PaperOut[] }>(`/exam/papers?${params.toString()}`, {
        timeoutMs: 16000,
        cacheKey: `exam-papers:${userId}:${SUBJECT}`,
      });
      setPapers(data.papers || []);
      if (!selectedPaperId && data.papers?.length) setSelectedPaperId(data.papers[0].id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load uploaded papers.");
    } finally {
      setLoadingPapers(false);
    }
  };

  const loadPatternSummary = async () => {
    if (!userId) return;
    try {
      const data = await callJson<PatternSummary>("/exam/pattern/summary", {
        timeoutMs: 16000,
        cacheKey: `exam-pattern-summary:${userId}`,
      });
      setPatternSummary(data);
      if (!patternAnalysis && data.latest_analysis) setPatternAnalysis(data.latest_analysis);
    } catch {
      setPatternSummary(null);
    }
  };

  const loadExtractedQuestions = async (paperId: number) => {
    setSelectedPaperId(paperId);
    setLoadingExtracted(true);
    setError("");
    try {
      const data = await callJson<{ paper_id: number; count: number; questions: ExtractedQuestion[] }>(`/exam/papers/${paperId}/questions`, {
        timeoutMs: 18000,
      });
      setExtractedQuestions(data.questions || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load extracted questions.");
    } finally {
      setLoadingExtracted(false);
    }
  };

  const loadReviewData = async () => {
    if (!userId || loadingReviewData) return;
    setLoadingReviewData(true);
    try {
      const [history, weaknessList, weaknessTopicList] = await Promise.allSettled([
        callJson<{ total: number; attempts: AttemptSummary[] }>(`/exam/written-practice/history?subject=${encodeURIComponent(SUBJECT)}&limit=20&offset=0`, {
          timeoutMs: 16000,
          cacheKey: `written-history:${userId}:${SUBJECT}`,
        }),
        callJson<{ total: number; weaknesses: Weakness[] }>(`/exam/student-weakness-report?subject=${encodeURIComponent(SUBJECT)}&limit=20&offset=0`, {
          timeoutMs: 16000,
          cacheKey: `weaknesses:${userId}:${SUBJECT}`,
        }),
        callJson<{ total_topics: number; topics: WeaknessTopic[] }>("/exam/student-weakness-report/by-topic", {
          timeoutMs: 16000,
          cacheKey: `weakness-topics:${userId}`,
        }),
      ]);
      if (history.status === "fulfilled") setWrittenHistory(history.value.attempts || []);
      if (weaknessList.status === "fulfilled") setWeaknesses(weaknessList.value.weaknesses || []);
      if (weaknessTopicList.status === "fulfilled") setWeaknessTopics(weaknessTopicList.value.topics || []);
    } finally {
      setLoadingReviewData(false);
    }
  };

  const openPanel = (panel: ExamPanel) => {
    setActivePanel(panel);
    setError("");
    if (panel === "papers" || panel === "probable") {
      void loadPapers();
      void loadPatternSummary();
    }
    if (panel === "practice") {
      void loadReviewData();
    }
  };

  const generateLegacyProbables = async () => {
    if (!userId) return [];
    const headers = await getAuthHeaders();
    const sessionSeed = `${userId}-${selectedTopic.value}-${Date.now()}`;
    const response = await apiFetch(`${backendURL}/generate-probable-questions`, {
      method: "POST",
      headers,
      timeoutMs: 45000,
      retries: 1,
      body: JSON.stringify({
        topic: selectedTopic.label,
        section_id: selectedTopic.value,
        session_id: `probable-${sessionSeed}`,
        difficulty: "medium",
        subject: SUBJECT,
        chapter: selectedChapter.label,
        strict_grounding: true,
        retrieval_required: true,
        fallback_to_general_knowledge: false,
        include_source: true,
        system_guardrail: EXAM_GUARDRAIL,
        required_not_found_response: MATERIAL_NOT_FOUND_MESSAGE,
      }),
    });
    if (!response.ok) return [];
    const data = await response.json().catch(() => null);
    const sourceLabel = `${selectedChapter.label} / ${selectedTopic.label}`;
    return Array.isArray(data?.questions)
      ? data.questions
          .map((question: unknown, index: number) => normalizeLegacyProbableQuestion(question, index, sourceLabel))
          .filter((question: LegacyProbableQuestion | null): question is LegacyProbableQuestion => Boolean(question))
      : [];
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
            subject: SUBJECT,
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
        generateLegacyProbables(),
      ]);

      const mcqResponse = mcqResult.status === "fulfilled" ? mcqResult.value : null;
      const nextProbable = probableResult.status === "fulfilled" ? probableResult.value : [];
      if (!mcqResponse?.ok) throw new Error("MCQ generation failed");

      const mcqData = await mcqResponse.json().catch(() => null);
      const sourceLabel = `${selectedChapter.label} / ${selectedTopic.label}`;
      const nextQuestions = Array.isArray(mcqData?.questions)
        ? mcqData.questions
            .map((question: unknown, index: number) => normalizeExamQuestion(question, index, sourceLabel))
            .filter((question: ExamQuestion | null): question is ExamQuestion => Boolean(question))
        : [];

      if (nextQuestions.length < 5) {
        setError(String(mcqData?.error || "A complete five-question pack could not be created from this material. Try another topic or regenerate."));
        return;
      }

      setQuestions(nextQuestions.slice(0, 5));
      setLegacyProbableQuestions(nextProbable);
      setNotice("MCQ pack created from the selected study material.");
      startedAtRef.current = new Date().toISOString();
      generationLatencyRef.current = Date.now() - requestStartedAt;
      if (nextProbable.length < 3) {
        setError("Your MCQ pack is ready. Syllabus probable questions are temporarily limited for this topic.");
      }
    } catch {
      setError("The exam pack could not be generated right now. Please retry after checking the selected study material.");
    } finally {
      setGenerating(false);
    }
  };

  const uploadPaper = async () => {
    if (!paperFile || !userId || uploadingPaper) return;
    if (paperFile.size > 8 * 1024 * 1024) {
      setError("Paper upload limit is 8 MB.");
      return;
    }

    setUploadingPaper(true);
    setError("");
    setNotice("");

    try {
      const form = new FormData();
      form.append("file", paperFile);
      form.append("class_level", classLevel);
      form.append("subject", SUBJECT);
      form.append("chapter_name", selectedChapter.label);
      form.append("exam_type", examType);
      if (paperTitle.trim()) form.append("paper_title", paperTitle.trim());

      const response = await apiFetch(`${backendURL}/exam/papers/upload`, {
        method: "POST",
        headers: removeContentType(await getAuthHeaders()),
        body: form,
        timeoutMs: 60000,
        retries: 0,
      });
      const data = await readResponseJson<PaperUploadResponse>(response);
      setLatestAnalysis(data.analysis);
      setSelectedPaperId(data.paper.id);
      setPaperFile(null);
      setPaperTitle("");
      setNotice(data.paper.parse_status === "needs_ocr"
        ? "This looks scanned. Upload a text-based PDF for analysis."
        : data.message || "Paper uploaded and analyzed.");
      if (data.paper.parse_status === "analyzed_empty" && data.warnings?.length) {
        setError(data.warnings.join(" "));
      }
      await loadPapers();
      void loadExtractedQuestions(data.paper.id);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Paper upload failed.");
    } finally {
      setUploadingPaper(false);
    }
  };

  const reanalyzePaper = async () => {
    if (!selectedPaperId || reanalyzingPaper) return;
    setReanalyzingPaper(true);
    setError("");
    try {
      const data = await callJson<PaperUploadResponse>(`/exam/papers/${selectedPaperId}/reanalyze`, {
        method: "POST",
        timeoutMs: 50000,
        body: {
          class_level: classLevel,
          subject: SUBJECT,
          chapter_name: selectedChapter.label,
          exam_type: examType,
        },
      });
      setLatestAnalysis(data.analysis);
      setNotice("Paper reanalysis is ready.");
      await loadPapers();
      void loadExtractedQuestions(selectedPaperId);
    } catch (reanalyzeError) {
      setError(reanalyzeError instanceof Error ? reanalyzeError.message : "Could not reanalyze this paper.");
    } finally {
      setReanalyzingPaper(false);
    }
  };

  const deletePaper = async (paperId: number) => {
    setError("");
    try {
      await callJson<{ status: string; id: number }>(`/exam/papers/${paperId}`, {
        method: "DELETE",
        timeoutMs: 16000,
      });
      setNotice("Paper deleted.");
      if (selectedPaperId === paperId) {
        setSelectedPaperId(null);
        setExtractedQuestions([]);
        setLatestAnalysis(null);
      }
      await loadPapers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this paper.");
    }
  };

  const analyzePattern = async () => {
    if (analyzingPattern) return;
    setAnalyzingPattern(true);
    setError("");
    setNotice("");
    try {
      const data = await callJson<PatternAnalysis>("/exam/pattern/analyze", {
        method: "POST",
        timeoutMs: 50000,
        body: {
          paper_ids: patternSourceIds.length ? patternSourceIds : undefined,
          class_level: classLevel,
          subject: SUBJECT,
          chapter_name: selectedChapter.label,
        },
      });
      setPatternAnalysis(data);
      setNotice("Pattern intelligence is ready.");
      void loadPatternSummary();
      openPanel("papers");
    } catch (patternError) {
      setError(patternError instanceof Error ? patternError.message : "Upload analyzed papers before running pattern intelligence.");
    } finally {
      setAnalyzingPattern(false);
    }
  };

  const generatePatternProbables = async () => {
    if (generatingPatternProbable) return;
    setGeneratingPatternProbable(true);
    setError("");
    setNotice("");
    try {
      const data = await callJson<ProbableQuestionSet>("/exam/probable-questions/generate", {
        method: "POST",
        timeoutMs: 50000,
        body: {
          analysis_id: patternAnalysis?.id,
          paper_ids: patternAnalysis ? null : patternSourceIds.length ? patternSourceIds : null,
          class_level: classLevel,
          subject: SUBJECT,
          chapter_name: selectedChapter.label,
          generation_mode: generationMode,
          count: 8,
          use_syllabus_grounding: true,
        },
      });
      setPatternQuestionSet(data);
      setProbableMode("paper_pattern");
      setNotice("Paper-pattern probable questions are ready.");
      openPanel("probable");
    } catch (probableError) {
      setError(probableError instanceof Error ? probableError.message : "Could not generate paper-pattern probable questions.");
    } finally {
      setGeneratingPatternProbable(false);
    }
  };

  const startWrittenSession = async () => {
    if (startingWritten) return writtenSession;
    setStartingWritten(true);
    setError("");
    try {
      const session = await callJson<WrittenSession>("/exam/written-practice/start", {
        method: "POST",
        timeoutMs: 18000,
        body: {
          class_level: classLevel,
          subject: SUBJECT,
          chapter_name: selectedChapter.label,
          topic: selectedTopic.label,
          marks_focus: marksFocus,
        },
      });
      setWrittenSession(session);
      setNotice("Written practice session started.");
      return session;
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "Could not start written practice.");
      return null;
    } finally {
      setStartingWritten(false);
    }
  };

  const getWrittenQuestion = async () => {
    if (generatingWrittenQuestion) return;
    setGeneratingWrittenQuestion(true);
    setError("");
    setNotice("");
    try {
      const session = writtenSession || await startWrittenSession();
      if (!session) return;
      const question = await callJson<WrittenQuestion>("/exam/written-practice/question", {
        method: "POST",
        timeoutMs: 30000,
        body: {
          session_id: session.id,
          topic: selectedTopic.label,
          marks_focus: marksFocus,
          question_type: writtenQuestionType,
          use_syllabus_grounding: true,
        },
      });
      setWrittenQuestion(question);
      setWrittenAnswer("");
      setWrittenFeedback(null);
      setNotice("Written question is ready.");
    } catch (questionError) {
      setError(questionError instanceof Error ? questionError.message : "Could not generate a written question.");
    } finally {
      setGeneratingWrittenQuestion(false);
    }
  };

  const submitWrittenAnswer = async () => {
    if (!writtenQuestion || !writtenAnswer.trim() || submittingWritten) return;
    setSubmittingWritten(true);
    setError("");
    setNotice("");
    try {
      const data = await callJson<{ attempt_id: number; feedback: WrittenFeedback; weaknesses_updated: number }>("/exam/written-practice/submit", {
        method: "POST",
        timeoutMs: 50000,
        body: {
          attempt_id: writtenQuestion.attempt_id,
          answer: writtenAnswer.trim(),
        },
      });
      setWrittenFeedback(data.feedback);
      setNotice(`${data.weaknesses_updated} weakness signal${data.weaknesses_updated === 1 ? "" : "s"} updated.`);
      await loadReviewData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not evaluate this answer.");
    } finally {
      setSubmittingWritten(false);
    }
  };

  const submitCustomWrittenAnswer = async () => {
    if (!customQuestionText.trim() || !customAnswer.trim() || submittingWritten) return;
    setSubmittingWritten(true);
    setError("");
    setNotice("");
    try {
      const session = writtenSession || await startWrittenSession();
      if (!session) return;
      const data = await callJson<{ attempt_id: number; feedback: WrittenFeedback; weaknesses_updated: number }>("/exam/written-practice/submit", {
        method: "POST",
        timeoutMs: 50000,
        body: {
          session_id: session.id,
          question_text: customQuestionText.trim(),
          marks_total: Math.max(1, toNumber(customMarks, 5)),
          answer: customAnswer.trim(),
          question_type: writtenQuestionType,
          topic: selectedTopic.label,
        },
      });
      setWrittenFeedback(data.feedback);
      setCustomQuestionText("");
      setCustomAnswer("");
      setNotice(`${data.weaknesses_updated} weakness signal${data.weaknesses_updated === 1 ? "" : "s"} updated.`);
      await loadReviewData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not evaluate this answer.");
    } finally {
      setSubmittingWritten(false);
    }
  };

  const loadAttemptFeedback = async (attemptId: number) => {
    setError("");
    try {
      const feedback = await callJson<WrittenFeedback>(`/exam/written-practice/attempts/${attemptId}/feedback`, {
        timeoutMs: 18000,
      });
      setWrittenFeedback(feedback);
      openPanel("practice");
    } catch (feedbackError) {
      setError(feedbackError instanceof Error ? feedbackError.message : "Feedback is not available for this attempt yet.");
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
    openPanel("practice");
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
          subject: SUBJECT,
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
            probable_questions: legacyProbableQuestions,
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

  const tabs: Array<[ExamPanel, string, string]> = [
    ["mcq", "MCQ Test", `${targetQuestionCount}`],
    ["papers", "Papers & Patterns", patternAnalysis ? "Ready" : papers.length ? `${papers.length}` : "New"],
    ["probable", "Probable Questions", patternQuestionSet ? `${patternQuestionSet.probable_questions.length}` : legacyProbableQuestions.length ? `${legacyProbableQuestions.length}` : "Build"],
    ["practice", "Practice & Review", submitted ? `${score}/${questions.length}` : writtenFeedback ? writtenScore : "Start"],
  ];

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
              Focused Assessment{classLevel ? ` / ${classLevel}` : ""}
            </p>
            <h1>Exam command center</h1>
            <p>{packIntent}</p>
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
              <AppIcon name={generating || uploadingPaper || analyzingPattern ? "clock" : submitted ? "analytics" : patternAnalysis ? "check" : "book"} />
            </span>
            <div>
              <p>Current phase</p>
              <strong>{packPhase}</strong>
            </div>
          </div>
          <p className="exam-hero-brief-copy">
            {patternAnalysis ? `${patternAnalysis.total_questions} observed questions across ${patternAnalysis.source_paper_ids.length} paper source${patternAnalysis.source_paper_ids.length === 1 ? "" : "s"}.` : "Keep the selected chapter as the source of truth across MCQ, uploaded papers, probable questions, and written practice."}
          </p>
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
              <p>Course scope</p>
              <strong>{selectedTopic.label}</strong>
              <span>{SUBJECT} / {selectedChapter.label}</span>
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
                    resetCourseContext();
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
                    resetCourseContext();
                  }}
                >
                  {selectedChapter.topics.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
            </div>
            <div className="exam-setup-actions">
              <button type="button" onClick={() => void generateExamPack()} disabled={generating || !userId} className="exam-mode-primary">
                {generating ? "Generating..." : questions.length ? "Regenerate MCQs" : "Generate MCQs"}
              </button>
              <button type="button" onClick={() => openPanel("papers")} className="exam-mode-secondary">
                Upload paper
              </button>
            </div>
          </section>

          <ExamReadinessStrip
            hasPack={Boolean(questions.length)}
            answeredCount={answeredCount}
            totalQuestions={targetQuestionCount}
            submitted={submitted}
            probableCount={patternQuestionSet?.probable_questions.length || legacyProbableQuestions.length}
            papersCount={papers.length}
            patternReady={Boolean(patternAnalysis)}
            writtenScore={writtenScore}
          />

          <div className="exam-mode-progress" aria-label={`${completion}% of questions answered`}>
            <span style={{ width: `${completion}%` }} />
          </div>

          {notice ? <div className="exam-mode-alert exam-mode-alert-success" role="status">{notice}</div> : null}
          {error ? <div className="exam-mode-alert" role="status">{error}</div> : null}

          <section className="exam-mode-workspace">
            <div className="exam-mode-tabs" role="tablist" aria-label="Exam sections">
              {tabs.map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activePanel === id}
                  onClick={() => openPanel(id)}
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
                      <h2>Build a five-question MCQ pack from {selectedTopic.label}.</h2>
                      <p>
                        AgentifyAI will create MCQs, explanations, and source traces from the connected study material only.
                      </p>
                      <div className="exam-launch-actions">
                        <button type="button" onClick={() => void generateExamPack()} disabled={generating || !userId} className="exam-mode-primary">
                          Generate MCQs
                        </button>
                        <Link href={studyHref} className="exam-mode-secondary">
                          Revise topic first
                        </Link>
                      </div>
                    </div>
                    <div className="exam-launch-checklist">
                      {[
                        { label: "Course locked", detail: `${selectedChapter.label} / ${selectedTopic.label}` },
                        { label: "Grounded only", detail: "No outside knowledge or guesses allowed" },
                        { label: "Review loop", detail: "Explanations unlock after one complete submission" },
                      ].map((item) => (
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

              {activePanel === "papers" ? (
                <div className="exam-panel-stack">
                  <div className="exam-workspace-header">
                    <div>
                      <p className="dashboard-section-kicker">Paper upload</p>
                      <h2>Upload previous papers for pattern intelligence</h2>
                    </div>
                    <button type="button" className="exam-mode-secondary" onClick={() => void loadPapers()} disabled={loadingPapers}>
                      {loadingPapers ? "Refreshing..." : "Refresh papers"}
                    </button>
                  </div>

                  <section className="exam-upload-grid">
                    <label className="exam-upload-zone">
                      <input
                        type="file"
                        accept=".pdf,.txt,.png,.jpg,.jpeg"
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setPaperFile(event.target.files?.[0] || null)}
                      />
                      <span aria-hidden="true"><AppIcon name="download" /></span>
                      <strong>{paperFile ? paperFile.name : "Choose a paper file"}</strong>
                      <small>{paperFile ? formatFileSize(paperFile.size) : "PDF, text, PNG, JPG, up to 8 MB"}</small>
                    </label>
                    <div className="exam-form-grid">
                      <label>
                        <span>Paper title</span>
                        <input value={paperTitle} onChange={(event) => setPaperTitle(event.target.value)} placeholder="Unit Test 1" />
                      </label>
                      <label>
                        <span>Exam type</span>
                        <select value={examType} onChange={(event) => setExamType(event.target.value)}>
                          {EXAM_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </label>
                      <button type="button" className="exam-mode-primary" onClick={() => void uploadPaper()} disabled={!paperFile || uploadingPaper}>
                        {uploadingPaper ? "Uploading..." : "Upload and analyze"}
                      </button>
                    </div>
                  </section>

                  {latestAnalysis ? (
                    <section className="exam-analysis-grid">
                      <div className="exam-score-card">
                        <span>Latest analysis</span>
                        <strong>{latestAnalysis.total_questions}</strong>
                        <p>Total marks: {formatMarks(latestAnalysis.total_marks)}</p>
                      </div>
                      <DistributionList title="Marks distribution" data={latestAnalysis.marks_distribution} />
                      <DistributionList title="Topic frequency" data={latestAnalysis.topic_frequency} />
                      <section className="exam-distribution-card">
                        <p className="dashboard-section-kicker">Repeated concepts</p>
                        <ChipList items={latestAnalysis.repeated_concepts || latestAnalysis.high_frequency_concepts || []} />
                      </section>
                    </section>
                  ) : null}

                  <section className="exam-paper-list">
                    {papers.length ? papers.map((paper) => (
                      <article key={paper.id} data-active={selectedPaperId === paper.id ? "true" : "false"}>
                        <button type="button" onClick={() => void loadExtractedQuestions(paper.id)}>
                          <strong>{paper.paper_title || paper.file_name}</strong>
                          <span>{formatLabel(paper.exam_type || "unknown")} / {formatDate(paper.uploaded_at)}</span>
                        </button>
                        <div className="exam-paper-meta">
                          <span>{paper.parse_status === "needs_ocr" ? "Needs text PDF" : formatLabel(paper.parse_status)}</span>
                          <span>{paper.extracted_question_count} questions</span>
                          <span>{formatConfidence(paper.extraction_confidence)}</span>
                        </div>
                        <div className="exam-paper-actions">
                          <button type="button" onClick={() => void loadExtractedQuestions(paper.id)}>Questions</button>
                          <button type="button" onClick={() => { setSelectedPaperId(paper.id); void analyzePattern(); }}>Use pattern</button>
                          <button type="button" onClick={() => void deletePaper(paper.id)}>Delete</button>
                        </div>
                      </article>
                    )) : (
                      <EmptyState
                        icon="download"
                        title="No papers uploaded yet"
                        detail="Upload a text-based PDF or text file to unlock pattern intelligence."
                      />
                    )}
                  </section>

                  {selectedPaperId ? (
                    <section className="exam-extracted-panel">
                      <div className="exam-workspace-header">
                        <div>
                          <p className="dashboard-section-kicker">Extracted questions</p>
                          <h2>{selectedPaper?.paper_title || selectedPaper?.file_name || "Selected paper"}</h2>
                        </div>
                        <button type="button" className="exam-mode-secondary" onClick={() => void reanalyzePaper()} disabled={reanalyzingPaper}>
                          {reanalyzingPaper ? "Reanalyzing..." : "Reanalyze"}
                        </button>
                      </div>
                      {loadingExtracted ? (
                        <LoadingState title="Loading extracted questions..." />
                      ) : extractedQuestions.length ? (
                        <div className="exam-extracted-list">
                          {extractedQuestions.map((question) => (
                            <article key={question.id}>
                              <span>{question.question_number || `Q${question.id}`} / {formatMarks(question.marks)} marks</span>
                              <h2>{question.question_text}</h2>
                              <p>{formatLabel(question.question_type)} / {formatLabel(question.difficulty)} / {displayValue(question.topic)}</p>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="exam-muted-copy">Select a paper to inspect extracted questions.</p>
                      )}
                    </section>
                  ) : null}
                </div>
              ) : null}

              {activePanel === "papers" ? (
                <div className="exam-panel-stack">
                  <div className="exam-workspace-header">
                    <div>
                      <p className="dashboard-section-kicker">Pattern intelligence</p>
                      <h2>{patternAnalysis ? "Observed exam pattern" : "Analyze uploaded papers"}</h2>
                    </div>
                    <div className="exam-action-row">
                      <button type="button" className="exam-mode-secondary" onClick={() => void loadPapers()} disabled={loadingPapers}>
                        Refresh papers
                      </button>
                      <button type="button" className="exam-mode-primary" onClick={() => void analyzePattern()} disabled={analyzingPattern}>
                        {analyzingPattern ? "Analyzing..." : "Analyze pattern"}
                      </button>
                    </div>
                  </div>

                  {patternAnalysis ? (
                    <>
                      <section className="exam-pattern-hero">
                        <div>
                          <p className="dashboard-section-kicker">Pattern summary</p>
                          <h2>{patternAnalysis.pattern_summary}</h2>
                        </div>
                        <div className="exam-kv-grid">
                          <div><span>Papers</span><strong>{patternAnalysis.source_paper_ids.length}</strong></div>
                          <div><span>Questions</span><strong>{patternAnalysis.total_questions}</strong></div>
                          <div><span>Total marks</span><strong>{formatMarks(patternAnalysis.total_marks)}</strong></div>
                          <div><span>Confidence</span><strong>{formatConfidence(patternAnalysis.confidence_score)}</strong></div>
                        </div>
                      </section>
                      <section className="exam-analysis-grid">
                        <DistributionList title="Marks" data={patternAnalysis.marks_distribution} />
                        <DistributionList title="Question type" data={patternAnalysis.question_type_distribution} />
                        <DistributionList title="Difficulty" data={patternAnalysis.difficulty_distribution} />
                        <DistributionList title="Topic frequency" data={patternAnalysis.topic_frequency} />
                      </section>
                      <section className="exam-analysis-grid">
                        <section className="exam-distribution-card">
                          <p className="dashboard-section-kicker">Repeated concepts</p>
                          <ChipList items={patternAnalysis.repeated_concepts || []} />
                        </section>
                        <DistributionList title="Chapter weightage" data={patternAnalysis.chapter_weightage} />
                      </section>
                    </>
                  ) : (
                    <EmptyState
                      icon="analytics"
                      title="Upload analyzed papers to read the pattern"
                      detail="Pattern analysis uses your uploaded papers and keeps the selected chapter scope intact."
                      action={<button type="button" className="exam-mode-primary" onClick={() => openPanel("papers")}>Open paper upload</button>}
                    />
                  )}

                  {patternSummary ? (
                    <section className="exam-extracted-panel">
                      <div className="exam-workspace-header">
                        <div>
                          <p className="dashboard-section-kicker">Saved intelligence</p>
                          <h2>{patternSummary.papers_analyzed}/{patternSummary.papers_total} papers analyzed</h2>
                        </div>
                      </div>
                      <div className="exam-chip-list">
                        {patternSummary.subjects.map((subject) => <span key={subject}>{subject}</span>)}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : null}

              {activePanel === "probable" ? (
                <div className="exam-panel-stack">
                  <div className="exam-workspace-header">
                    <div>
                      <p className="dashboard-section-kicker">Probable questions</p>
                      <h2>{probableMode === "paper_pattern" ? "Paper-pattern mode" : "Syllabus mode"}</h2>
                    </div>
                    <div className="exam-segmented-control" aria-label="Probable question mode">
                      <button type="button" data-active={probableMode === "paper_pattern" ? "true" : "false"} onClick={() => setProbableMode("paper_pattern")}>Paper pattern</button>
                      <button type="button" data-active={probableMode === "syllabus" ? "true" : "false"} onClick={() => setProbableMode("syllabus")}>Syllabus</button>
                    </div>
                  </div>

                  {probableMode === "paper_pattern" ? (
                    <>
                      <section className="exam-toolbar-panel">
                        <label>
                          <span>Generation mode</span>
                          <select value={generationMode} onChange={(event) => setGenerationMode(event.target.value as GenerationMode)}>
                            {GENERATION_MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                        </label>
                        <button type="button" className="exam-mode-primary" onClick={() => void generatePatternProbables()} disabled={generatingPatternProbable}>
                          {generatingPatternProbable ? "Generating..." : "Generate from uploaded papers"}
                        </button>
                      </section>

                      {patternQuestionSet ? (
                        <>
                          <section className="exam-disclaimer-panel">
                            <strong>Guidance disclaimer</strong>
                            <p>{patternQuestionSet.disclaimer}</p>
                          </section>
                          <section className="exam-probable-grid exam-probable-grid-wide">
                            {patternQuestionSet.probable_questions.map((question) => (
                              <article key={question.id} className="exam-probable-item" data-priority={question.priority}>
                                <span>{formatLabel(question.priority)} priority / {formatMarks(question.marks)} marks</span>
                                <h2>{question.question}</h2>
                                <p>{formatLabel(question.question_type)} / {displayValue(question.topic)}</p>
                                <small>{question.based_on}</small>
                              </article>
                            ))}
                          </section>
                          <section className="exam-extracted-panel">
                            <p className="dashboard-section-kicker">Priority topics</p>
                            <div className="exam-priority-list">
                              {patternQuestionSet.priority_topics.map((item) => (
                                <article key={`${item.topic}-${item.weight}`}>
                                  <strong>{formatLabel(item.topic)}</strong>
                                  <p>{item.reason}</p>
                                  <span>{formatLabel(item.weight)}</span>
                                </article>
                              ))}
                            </div>
                          </section>
                        </>
                      ) : (
                        <EmptyState
                          icon="book"
                          title="Generate paper-pattern probable questions"
                          detail="Use analyzed uploads to produce likely practice prompts with a required disclaimer."
                          action={<button type="button" className="exam-mode-primary" onClick={() => void generatePatternProbables()}>Generate paper-pattern prompts</button>}
                        />
                      )}
                    </>
                  ) : (
                    legacyProbableQuestions.length ? (
                      <div className="exam-probable-grid">
                        {[
                          ["3-mark questions", threeMarkQuestions],
                          ["5-mark questions", fiveMarkQuestions],
                        ].map(([label, items]) => (
                          <section key={String(label)} className="exam-probable-card">
                            <p className="dashboard-section-kicker">{String(label)}</p>
                            <div>
                              {(items as LegacyProbableQuestion[]).map((question) => (
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
                        title="No syllabus probable questions yet"
                        detail="Generate MCQs to prepare topic-grounded theory questions from study material."
                        action={<button type="button" className="exam-mode-primary" onClick={() => void generateExamPack()}>Generate MCQs and prompts</button>}
                      />
                    )
                  )}
                </div>
              ) : null}

              {activePanel === "practice" ? (
                <div className="exam-panel-stack">
                  <div className="exam-workspace-header">
                    <div>
                      <p className="dashboard-section-kicker">Written practice</p>
                      <h2>Teacher-style answer evaluation</h2>
                    </div>
                    <button type="button" className="exam-mode-secondary" onClick={() => void loadReviewData()} disabled={loadingReviewData}>
                      {loadingReviewData ? "Syncing..." : "Sync history"}
                    </button>
                  </div>

                  <section className="exam-toolbar-panel">
                    <label>
                      <span>Marks focus</span>
                      <input value={marksFocus} onChange={(event) => setMarksFocus(event.target.value)} />
                    </label>
                    <label>
                      <span>Question type</span>
                      <select value={writtenQuestionType} onChange={(event) => setWrittenQuestionType(event.target.value)}>
                        {QUESTION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </label>
                    <button type="button" className="exam-mode-primary" onClick={() => void getWrittenQuestion()} disabled={startingWritten || generatingWrittenQuestion}>
                      {generatingWrittenQuestion ? "Preparing..." : "Get written question"}
                    </button>
                  </section>

                  <section className="exam-written-layout">
                    <div className="exam-written-question">
                      {writtenQuestion ? (
                        <>
                          <span>{formatLabel(writtenQuestion.question_type)} / {writtenQuestion.marks_total} marks / {formatLabel(writtenQuestion.command_word)}</span>
                          <h2>{writtenQuestion.question_text}</h2>
                          <textarea
                            value={writtenAnswer}
                            onChange={(event) => setWrittenAnswer(event.target.value)}
                            placeholder="Write your answer here."
                            rows={8}
                          />
                          <button type="button" className="exam-mode-primary" onClick={() => void submitWrittenAnswer()} disabled={!writtenAnswer.trim() || submittingWritten}>
                            {submittingWritten ? "Evaluating..." : "Submit answer"}
                          </button>
                        </>
                      ) : (
                        <EmptyState
                          icon="study"
                          title="Start generated written practice"
                          detail="The question arrives without the marking scheme. Feedback appears only after submission."
                          action={<button type="button" className="exam-mode-primary" onClick={() => void getWrittenQuestion()}>Get written question</button>}
                        />
                      )}
                    </div>

                    <div className="exam-written-question">
                      <span>Self-chosen question</span>
                      <input value={customQuestionText} onChange={(event) => setCustomQuestionText(event.target.value)} placeholder="Paste your question" />
                      <input value={customMarks} onChange={(event) => setCustomMarks(event.target.value)} placeholder="Marks" />
                      <textarea value={customAnswer} onChange={(event) => setCustomAnswer(event.target.value)} placeholder="Write your answer here." rows={7} />
                      <button type="button" className="exam-mode-secondary" onClick={() => void submitCustomWrittenAnswer()} disabled={!customQuestionText.trim() || !customAnswer.trim() || submittingWritten}>
                        Grade self-chosen answer
                      </button>
                    </div>
                  </section>

                  {writtenFeedback ? (
                    <section className="exam-feedback-panel">
                      <div className="exam-score-card">
                        <span>Teacher score</span>
                        <strong>{formatMarks(writtenFeedback.marks_awarded)}/{formatMarks(writtenFeedback.marks_total)}</strong>
                        <p>{Math.round(writtenFeedback.score_percentage)}% score</p>
                      </div>
                      <div className="exam-feedback-main">
                        <h2>{writtenFeedback.teacher_feedback}</h2>
                        <p>{writtenFeedback.improve_to_full_marks}</p>
                        <div className="exam-feedback-grid">
                          <section>
                            <p className="dashboard-section-kicker">Covered</p>
                            <ChipList items={writtenFeedback.covered_points || []} empty="No covered points returned." />
                          </section>
                          <section>
                            <p className="dashboard-section-kicker">Missing</p>
                            <ChipList items={writtenFeedback.missing_points || []} empty="No missing points returned." />
                          </section>
                        </div>
                        <section className="exam-rubric-list">
                          {Object.entries(writtenFeedback.rubric_scores || {}).map(([key, value]) => (
                            <div key={key}>
                              <span>{formatLabel(key)}</span>
                              <strong>{formatConfidence(value)}</strong>
                              <i style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
                            </div>
                          ))}
                        </section>
                        <section className="exam-model-answer">
                          <p className="dashboard-section-kicker">Model answer</p>
                          <p>{writtenFeedback.model_answer}</p>
                        </section>
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : null}

              {activePanel === "practice" ? (
                <div className="exam-panel-stack">
                  <div className="exam-workspace-header">
                    <div>
                      <p className="dashboard-section-kicker">Review</p>
                      <h2>MCQ mistakes and written-answer weakness report</h2>
                    </div>
                    <button type="button" className="exam-mode-secondary" onClick={() => void loadReviewData()} disabled={loadingReviewData}>
                      {loadingReviewData ? "Refreshing..." : "Refresh review"}
                    </button>
                  </div>

                  {submitted ? (
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
                      title="Submit the MCQ test to unlock MCQ review"
                      detail="Written feedback and weakness history can still be reviewed below."
                    />
                  )}

                  <section className="exam-analysis-grid">
                    <section className="exam-distribution-card">
                      <p className="dashboard-section-kicker">Weak topics</p>
                      {weaknessTopics.length ? (
                        <div className="exam-priority-list">
                          {weaknessTopics.slice(0, 6).map((item) => (
                            <article key={`${item.subject}-${item.topic}`}>
                              <strong>{formatLabel(item.topic)}</strong>
                              <p>{item.latest_suggestion}</p>
                              <span>{item.total_frequency}</span>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="exam-muted-copy">No written-practice weakness report yet.</p>
                      )}
                    </section>
                    <section className="exam-distribution-card">
                      <p className="dashboard-section-kicker">Recent written attempts</p>
                      {writtenHistory.length ? (
                        <div className="exam-history-list">
                          {writtenHistory.slice(0, 6).map((attempt) => (
                            <article key={attempt.id}>
                              <div>
                                <strong>{attempt.question_text}</strong>
                                <span>{formatLabel(attempt.evaluation_status)} / {formatDate(attempt.submitted_at || attempt.created_at)}</span>
                              </div>
                              <button type="button" onClick={() => void loadAttemptFeedback(attempt.id)}>
                                {attempt.marks_awarded == null ? EMPTY_VALUE : `${attempt.marks_awarded}/${attempt.marks_total}`}
                              </button>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="exam-muted-copy">No written attempts yet.</p>
                      )}
                    </section>
                  </section>

                  {weaknesses.length ? (
                    <section className="exam-weakness-grid">
                      {weaknesses.slice(0, 8).map((weakness) => (
                        <article key={weakness.id}>
                          <span>{formatLabel(weakness.weakness_type)} / seen {weakness.frequency_count}</span>
                          <h2>{formatLabel(weakness.topic)}</h2>
                          <p>{weakness.weakness_summary}</p>
                          <small>{weakness.improvement_suggestion}</small>
                        </article>
                      ))}
                    </section>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </main>

        <aside className="exam-mode-brief-rail exam-mode-insight-grid" aria-label="Exam guidance">
          <section className="exam-brief-panel">
            <p className="dashboard-section-kicker">Exam brief</p>
            <h2>{selectedTopic.label}</h2>
            <p>{SUBJECT} / {classLevel} / {selectedChapter.label}</p>
            <div className="exam-brief-topic">
              <span>Uploaded papers</span>
              <strong>{papers.length}</strong>
            </div>
          </section>

          <section className="exam-brief-panel">
            <p className="dashboard-section-kicker">Pattern signal</p>
            <h2>{patternAnalysis ? formatConfidence(patternAnalysis.confidence_score) : EMPTY_VALUE}</h2>
            <p>{patternAnalysis?.pattern_summary || "Run pattern analysis after uploading papers."}</p>
          </section>

          <section className="exam-brief-panel">
            <p className="dashboard-section-kicker">Grounding rules</p>
            <div className="exam-brief-list">
              {[
                "MCQs stay on selected study material.",
                "Uploaded-paper probable prompts show the disclaimer.",
                "Written feedback reveals marking points only after submission.",
              ].map((item) => (
                <div key={item}>
                  <AppIcon name="check" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
