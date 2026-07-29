import { toNumber } from "@/lib/format";

export type ParseStatus = "pending" | "analyzed" | "analyzed_empty" | "needs_ocr" | "failed";
export type Priority = "high" | "medium" | "low";
export type EvaluationStatus = "awaiting_answer" | "evaluating" | "evaluated";
export type ProbableMode = "syllabus" | "paper_pattern";

export type ExamQuestion = {
  id: string;
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  source?: string;
};

export type LegacyProbableQuestion = {
  id: string;
  marks: number | null;
  question: string;
  source?: string;
};

export type PaperOut = {
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

export type PaperAnalysis = {
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

export type ExtractedQuestion = {
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

export type PaperUploadResponse = {
  paper: PaperOut;
  analysis: PaperAnalysis;
  questions_extracted: number;
  warnings: string[];
  message: string;
};

export type PatternAnalysis = {
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

export type PatternSummary = {
  papers_total: number;
  papers_analyzed: number;
  subjects: string[];
  latest_analysis: PatternAnalysis | null;
  analyses: PatternAnalysis[];
};

export type PatternProbableQuestion = {
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

export type ProbableQuestionSet = {
  id: number;
  class_level: string;
  subject: string;
  chapter_id: number | null;
  chapter_name: string;
  source_analysis_ids: number[];
  generation_mode: string;
  probable_questions: PatternProbableQuestion[];
  priority_topics: { topic: string; reason: string; weight: Priority }[];
  strategy_summary: string;
  disclaimer: string;
  confidence_score: number;
  created_at: string | null;
};

export type WrittenSession = {
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

export type WrittenQuestion = {
  attempt_id: number;
  session_id: number;
  question_text: string;
  question_type: string;
  marks_total: number;
  topic: string;
  command_word: string;
  evaluation_status: EvaluationStatus;
};

export type WrittenFeedback = {
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

export type AttemptSummary = {
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

export type Weakness = {
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

export type WeaknessTopic = {
  topic: string;
  subject: string;
  total_frequency: number;
  weakness_types: string[];
  latest_suggestion: string;
};

export type PapersResponse = { total: number; papers: PaperOut[] };
export type ExtractedQuestionsResponse = { paper_id: number; count: number; questions: ExtractedQuestion[] };
export type ProbableQuestionSetsResponse = { total: number; sets: ProbableQuestionSet[] };
export type WrittenHistoryResponse = { total: number; attempts: AttemptSummary[] };
export type WeaknessesResponse = { total: number; weaknesses: Weakness[] };
export type WeaknessTopicsResponse = { total_topics: number; topics: WeaknessTopic[] };
export type WrittenSubmitResponse = {
  attempt_id: number;
  feedback: WrittenFeedback;
  weaknesses_updated: number;
};

export function normalizeTopicValue(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function isBackendFailureText(value: unknown) {
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

export function normalizeCorrectOption(correctValue: unknown, options: string[]) {
  const correct = String(correctValue || "").trim();
  const letter = correct.slice(0, 1).toUpperCase();
  if (/^[A-D]$/.test(letter)) return letter;
  const index = options.findIndex((option) => option.trim().toLowerCase() === correct.toLowerCase());
  return index >= 0 ? String.fromCharCode(65 + index) : "";
}

export function normalizeExamQuestion(raw: unknown, index: number, fallbackSource: string): ExamQuestion | null {
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

export function normalizeLegacyProbableQuestion(
  raw: unknown,
  index: number,
  fallbackSource: string,
): LegacyProbableQuestion | null {
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

export function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function clampMetric(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function formatExamDate(value: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatMarks(value: number | null | undefined) {
  return value === null || value === undefined ? "--" : String(value);
}

export function formatConfidence(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  const numeric = Number(value);
  return `${Math.round(numeric <= 1 ? numeric * 100 : numeric)}%`;
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "--";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
