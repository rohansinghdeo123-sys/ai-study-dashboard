export type LearningModeId = "planning" | "study" | "revision" | "exam";

export type ProgressSummary = {
  total_tests: number;
  total_questions: number;
  total_correct: number;
  xp: number;
  streak: number;
};

export type SessionRecord = {
  id: string;
  subject: string;
  class_level?: string;
  topic: string;
  total_questions: number;
  score: number;
  xp_earned: number;
  time_spent_seconds: number;
  session_type: string;
  completed_at: string;
};
