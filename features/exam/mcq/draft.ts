export const MCQ_DRAFT_VERSION = 1 as const;

export type McqDifficulty = "easy" | "medium" | "advanced";

export type McqDraftQuestion = {
  id: string;
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  source?: string;
};

export type McqAttemptDraft = {
  version: typeof MCQ_DRAFT_VERSION;
  userId: string;
  chapter: string;
  chapterLabel: string;
  topic: string;
  topicLabel: string;
  questionCount: 5 | 10;
  difficulty: McqDifficulty;
  questions: McqDraftQuestion[];
  answers: Record<string, string>;
  retryCount: number;
  currentIndex: number;
  startedAt: string;
  generationLatencyMs: number;
  savedAt: string;
};

const DRAFT_PREFIX = `agentifyai:exam:mcq:v${MCQ_DRAFT_VERSION}`;

function scopePart(value: string) {
  return encodeURIComponent(value.trim().toLowerCase() || "unknown");
}

export function getMcqDraftKey(userId: string, chapter: string, topic: string) {
  return `${DRAFT_PREFIX}:${scopePart(userId)}:${scopePart(chapter)}:${scopePart(topic)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDraftQuestion(value: unknown): value is McqDraftQuestion {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.question === "string" &&
    Array.isArray(value.options) &&
    value.options.length === 4 &&
    value.options.every((option) => typeof option === "string") &&
    typeof value.correct === "string" &&
    /^[A-D]$/.test(value.correct) &&
    typeof value.explanation === "string" &&
    (value.source === undefined || typeof value.source === "string")
  );
}

export function readMcqDraft(key: string): McqAttemptDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;

    const questions = value.questions;
    const answers = value.answers;
    const difficulty = value.difficulty;
    const questionCount = value.questionCount;

    if (
      value.version !== MCQ_DRAFT_VERSION ||
      typeof value.userId !== "string" ||
      typeof value.chapter !== "string" ||
      typeof value.chapterLabel !== "string" ||
      typeof value.topic !== "string" ||
      typeof value.topicLabel !== "string" ||
      (questionCount !== 5 && questionCount !== 10) ||
      (difficulty !== "easy" && difficulty !== "medium" && difficulty !== "advanced") ||
      !Array.isArray(questions) ||
      questions.length === 0 ||
      !questions.every(isDraftQuestion) ||
      !isRecord(answers) ||
      !Object.values(answers).every((answer) => typeof answer === "string" && /^[A-D]$/.test(answer)) ||
      typeof value.retryCount !== "number" ||
      typeof value.currentIndex !== "number" ||
      typeof value.startedAt !== "string" ||
      !Number.isFinite(new Date(value.startedAt).getTime()) ||
      typeof value.generationLatencyMs !== "number" ||
      typeof value.savedAt !== "string"
    ) {
      return null;
    }

    return {
      version: MCQ_DRAFT_VERSION,
      userId: value.userId,
      chapter: value.chapter,
      chapterLabel: value.chapterLabel,
      topic: value.topic,
      topicLabel: value.topicLabel,
      questionCount,
      difficulty,
      questions,
      answers: answers as Record<string, string>,
      retryCount: Math.max(0, Math.round(value.retryCount)),
      currentIndex: Math.max(0, Math.round(value.currentIndex)),
      startedAt: value.startedAt,
      generationLatencyMs: Math.max(0, Math.round(value.generationLatencyMs)),
      savedAt: value.savedAt,
    };
  } catch {
    return null;
  }
}

export function writeMcqDraft(key: string, draft: McqAttemptDraft) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // A full or unavailable session store must never interrupt an exam attempt.
  }
}

export function clearMcqDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Storage access can be disabled by the browser; clearing is best effort.
  }
}
