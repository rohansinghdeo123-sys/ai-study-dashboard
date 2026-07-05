/**
 * Static Exam Mode configuration shared by the exam page and its panels.
 * Behavior-free constants only — grounding contracts and selector options.
 */

export type GenerationMode = "mixed" | "chapter_wise" | "marks_wise" | "section_wise";

export const SUBJECT = "Chemistry";
export const DEFAULT_CLASS_LEVEL = "Class 11";
export const EMPTY_VALUE = "--";

export const EXAM_TYPES = [
  { value: "unit_test", label: "Unit test" },
  { value: "class_test", label: "Class test" },
  { value: "school_exam", label: "School exam" },
  { value: "pre_board", label: "Pre-board" },
  { value: "board_exam", label: "Board exam" },
  { value: "chapter_wise", label: "Chapter-wise" },
  { value: "subject_wise", label: "Subject-wise" },
  { value: "other", label: "Other" },
];

export const QUESTION_TYPES = [
  { value: "long_answer", label: "Long answer" },
  { value: "short_answer", label: "Short answer" },
  { value: "numerical", label: "Numerical" },
  { value: "diagram", label: "Diagram" },
  { value: "case_based", label: "Case based" },
];

export const GENERATION_MODES: Array<{ value: GenerationMode; label: string }> = [
  { value: "mixed", label: "Mixed" },
  { value: "chapter_wise", label: "Chapter-wise" },
  { value: "marks_wise", label: "Marks-wise" },
  { value: "section_wise", label: "Section-wise" },
];

export const EXAM_GUARDRAIL = [
  "Use only the uploaded or ingested study material and selected course context.",
  "Do not use outside knowledge, generic model memory, or guesses.",
  "Every MCQ must have exactly four options, one correct answer, a clear explanation, and a traceable source.",
  "If the material is insufficient, return an explicit material-not-found error instead of inventing content.",
].join(" ");

export const MATERIAL_NOT_FOUND_MESSAGE =
  "I could not find this in your study material. Please upload or select the correct chapter/data.";
