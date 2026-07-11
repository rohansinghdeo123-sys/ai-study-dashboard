import type { AppIconName } from "@/components/ui/Polished";
import type {
  AgentStageId,
  ArtifactType,
  ExamPanel,
  RevisionTool,
  StudyMode,
} from "@/features/study/types";

export const REVISION_TOOLS: RevisionTool[] = [
  {
    id: "summary",
    title: "Summary",
    detail: "A clean revision note from the selected chapter data.",
    mode: "summary",
    prompt: (topic) => `Create simple revision notes for ${topic} from the selected study material only.`,
  },
  {
    id: "explain",
    title: "Deep Dive",
    detail: "A deeper teacher-style explanation while staying grounded in the material.",
    mode: "explain",
    prompt: (topic) => `Deeply explain ${topic} from the selected study material only, with examples if available in the data.`,
  },
  {
    id: "keypoints",
    title: "Quick Recall",
    detail: "High-yield recall bullets for fast exam revision.",
    mode: "keypoints",
    prompt: (topic) => `Extract the most important key points for ${topic} from the selected study material only.`,
  },
];

export const ARTIFACT_TABS: Array<{ id: ArtifactType; label: string; icon: AppIconName }> = [
  { id: "flip_cards", label: "Cards", icon: "copy" },
  { id: "mistake_cards", label: "Mistakes", icon: "check" },
];

export const EXAM_TABS: Array<{ id: ExamPanel; label: string; detail: string; icon: AppIconName }> = [
  { id: "mcq", label: "MCQ", detail: "Attempt grounded multiple-choice questions.", icon: "check" },
  { id: "probable", label: "Probable", detail: "Review likely theory questions from the chapter.", icon: "book" },
  { id: "practice", label: "Practice", detail: "Use the same question set as a quick drill.", icon: "study" },
  { id: "review", label: "Review", detail: "Check score, explanations, and sources.", icon: "analytics" },
];

export const STUDY_MODES: Array<{ id: StudyMode; label: string; detail: string; icon: AppIconName }> = [
  { id: "coach", label: "Chat", detail: "Ask doubts and continue your study conversation.", icon: "study" },
  { id: "revision", label: "Revision", detail: "Open summaries, explanations, recall notes, and study tools.", icon: "book" },
];

export const STAGE_ORDER: AgentStageId[] = ["received", "understanding", "drafting", "reviewing", "formatting", "delivering"];

export const MATERIAL_NOT_FOUND_MESSAGE = "I could not find this in your study material. Please upload or select the correct chapter/data.";
export const TUTOR_TEMPORARY_ERROR_MESSAGE = "I could not complete that response right now. Please try again.";

export const DATA_GROUNDED_TUTOR_GUARDRAIL = [
  "You are AgentifyAI's study tutor working inside a data-grounded learning app.",
  "Use only the uploaded or ingested study material, selected subject, selected chapter, selected topic, and retrieved context supplied by the backend.",
  "Do not use outside knowledge, generic LLM memory, or guesses.",
  "If the retrieved context does not contain the answer, reply exactly: I could not find this in your study material. Please upload or select the correct chapter/data.",
  "Preserve conversation continuity. Follow-up words like this, it, explain again, simplify, more examples, and simple words refer to the previous user question and previous tutor answer unless the student clearly changes topic.",
  "Never switch topic unless the student clearly asks for a new topic.",
  "Keep answers exam-focused, clear, and traceable to the study material.",
].join(" ");

export const REASONING_FIRST_TUTOR_GUARDRAIL = [
  "You are AgentifyAI's reasoning-first private tutor for school students.",
  "Understand the student's intent, resolve follow-up context, choose the best teaching strategy, and then answer.",
  "Use conversation memory and reliable subject reasoning naturally. Do not behave like a keyword-search bot.",
  "Use retrieved study material only when the student asks for notes, textbook, syllabus, uploaded data, or source-grounded verification.",
  "If source grounding is explicitly requested and the material is unavailable, explain that clearly and ask for the missing material.",
  "Preserve conversation continuity. Follow-up words like this, it, explain again, simplify, more examples, and simple words refer to the previous user question and previous tutor answer unless the student clearly changes topic.",
  "Remain subject-agnostic, calm, accurate, student-friendly, and clear.",
].join(" ");
