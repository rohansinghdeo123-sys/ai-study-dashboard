import type { LegacyProbableQuestion, PatternProbableQuestion } from "@/features/exam/contracts";

function isFailureText(value: unknown) {
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

export function normalizeSyllabusProbables(payload: unknown, fallbackSource: string): LegacyProbableQuestion[] {
  if (!payload || typeof payload !== "object") return [];
  const questions = (payload as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) return [];
  return questions
    .map((raw, index): LegacyProbableQuestion | null => {
      if (!raw || typeof raw !== "object") return null;
      const record = raw as Record<string, unknown>;
      const question = String(record.question || record.text || "").trim();
      if (!question || isFailureText(question)) return null;
      const fallbackMarks = index < 2 ? 3 : 5;
      const marksValue = Number(record.marks ?? fallbackMarks);
      return {
        id: String(record.id || `syllabus-${index + 1}`),
        question,
        marks: Number.isFinite(marksValue) ? marksValue : fallbackMarks,
        source: String(record.source || record.reference || record.topic || record.section_id || fallbackSource).trim(),
      };
    })
    .filter((question): question is LegacyProbableQuestion => Boolean(question));
}

export type ProbableDisplayQuestion = {
  id: string;
  question: string;
  marks: number | null;
  questionType: string;
  topic: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  source: string;
};

function normalizePriority(value: unknown): "high" | "medium" | "low" {
  const priority = String(value || "").toLowerCase();
  return priority === "high" || priority === "low" ? priority : "medium";
}

export function fromPatternQuestion(question: PatternProbableQuestion, index: number): ProbableDisplayQuestion {
  return {
    id: String(question.id || `pattern-${index + 1}`),
    question: String(question.question || ""),
    marks: question.marks ?? null,
    questionType: String(question.question_type || "Practice question"),
    topic: String(question.topic || ""),
    priority: normalizePriority(question.priority),
    rationale: String(question.based_on || "Selected paper pattern"),
    source: String(question.source || "Uploaded paper intelligence"),
  };
}

export function fromSyllabusQuestion(question: LegacyProbableQuestion, index: number): ProbableDisplayQuestion {
  return {
    id: String(question.id || `syllabus-${index + 1}`),
    question: question.question,
    marks: question.marks ?? null,
    questionType: "Theory practice",
    topic: "",
    priority: index < 2 ? "high" : index < 5 ? "medium" : "low",
    rationale: "Grounded in the selected syllabus material",
    source: question.source || "Selected chapter material",
  };
}

export function sortProbableQuestions(questions: ProbableDisplayQuestion[]) {
  const weight = { high: 0, medium: 1, low: 2 } as const;
  return [...questions].sort((left, right) => weight[left.priority] - weight[right.priority]);
}
