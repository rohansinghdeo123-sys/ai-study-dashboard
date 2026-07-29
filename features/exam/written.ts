import { examApiRequest } from "@/features/exam/api";
import type {
  AttemptSummary,
  Weakness,
  WeaknessTopic,
  WrittenFeedback,
  WrittenQuestion,
  WrittenSession,
  WrittenSubmitResponse,
} from "@/features/exam/contracts";

export type {
  AttemptSummary,
  EvaluationStatus,
  Weakness,
  WeaknessTopic,
  WrittenFeedback,
  WrittenQuestion,
  WrittenSession,
} from "@/features/exam/contracts";

type RequestContext = {
  backendURL: string;
  headers: HeadersInit;
};

type StartSessionInput = {
  class_level: string;
  subject: string;
  chapter_name: string;
  topic: string;
  marks_focus: string;
};

type GenerateQuestionInput = {
  session_id: number;
  topic: string;
  marks_focus: string;
  question_type: string;
  use_syllabus_grounding: true;
};

async function postJson<T>(context: RequestContext, path: string, body: unknown, timeoutMs = 50000) {
  return examApiRequest<T>(path, {
    method: "POST",
    backendURL: context.backendURL,
    headers: context.headers,
    body,
    retries: 0,
    timeoutMs,
    invalidate: ["written-", "weakness"],
  });
}

export function startWrittenSession(context: RequestContext, input: StartSessionInput) {
  return postJson<WrittenSession>(context, "/exam/written-practice/start", input, 18000);
}

export function generateWrittenQuestion(context: RequestContext, input: GenerateQuestionInput) {
  return postJson<WrittenQuestion>(context, "/exam/written-practice/question", input, 30000);
}

export function submitGeneratedAnswer(
  context: RequestContext,
  input: { attempt_id: number; answer: string },
) {
  return postJson<WrittenSubmitResponse>(context, "/exam/written-practice/submit", input);
}

export function submitCustomAnswer(
  context: RequestContext,
  input: {
    session_id: number;
    question_text: string;
    marks_total: number;
    answer: string;
    question_type: string;
    topic: string;
  },
) {
  return postJson<WrittenSubmitResponse>(context, "/exam/written-practice/submit", input);
}

export function fetchWrittenHistory(context: RequestContext, subject: string) {
  const query = new URLSearchParams({ subject, limit: "50", offset: "0" });
  return examApiRequest<{ total: number; attempts: AttemptSummary[] }>(
    `/exam/written-practice/history?${query.toString()}`,
    {
      backendURL: context.backendURL,
      headers: context.headers,
      retries: 1,
      timeoutMs: 18000,
      forceFresh: true,
    },
  );
}

export function fetchWeaknesses(context: RequestContext, subject: string) {
  const query = new URLSearchParams({ subject, limit: "50", offset: "0" });
  return examApiRequest<{ total: number; weaknesses: Weakness[] }>(
    `/exam/student-weakness-report?${query.toString()}`,
    {
      backendURL: context.backendURL,
      headers: context.headers,
      retries: 1,
      timeoutMs: 18000,
      forceFresh: true,
    },
  );
}

export function fetchWeaknessTopics(context: RequestContext) {
  return examApiRequest<{ total_topics: number; topics: WeaknessTopic[] }>(
    "/exam/student-weakness-report/by-topic",
    {
      backendURL: context.backendURL,
      headers: context.headers,
      retries: 1,
      timeoutMs: 18000,
      forceFresh: true,
    },
  );
}

export function fetchAttemptFeedback(context: RequestContext, attemptId: number) {
  return examApiRequest<WrittenFeedback>(
    `/exam/written-practice/attempts/${attemptId}/feedback`,
    {
      backendURL: context.backendURL,
      headers: context.headers,
      retries: 1,
      timeoutMs: 18000,
      forceFresh: true,
    },
  );
}
