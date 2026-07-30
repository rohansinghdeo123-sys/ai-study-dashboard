import type { StudyArtifact, StudyArtifactResponse } from "@/features/study/types";
import { ApiRequestError, apiJson } from "@/lib/apiClient";

export const REVISION_MATERIAL_NOT_FOUND =
  "I could not find this in your study material. Please upload or select the correct chapter/data.";

export type RevisionRequestContext = {
  backendURL?: string;
  getAuthHeaders: () => Promise<HeadersInit>;
  userId: string;
};

export type RevisionContentScope = {
  subject: string;
  chapterId: string;
  chapterLabel: string;
  topicId: string;
  topicLabel: string;
};

export type RevisionLessonPack = {
  explanation: string;
  notes: string;
  generatedAt: string;
  partial: boolean;
};

export type RevisionApiErrorCode =
  | "auth_required"
  | "material_missing"
  | "rate_limited"
  | "timeout"
  | "service_unavailable"
  | "invalid_response";

export class RevisionApiError extends Error {
  code: RevisionApiErrorCode;
  status: number;

  constructor(message: string, code: RevisionApiErrorCode, status = 0) {
    super(message);
    this.name = "RevisionApiError";
    this.code = code;
    this.status = status;
  }
}

function backendURL(override?: string) {
  return (override || process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

function ownedSessionId(userId: string, topicId: string, mode: string) {
  return `revision-${userId}-${topicId}-${mode}-v2`.slice(0, 218);
}

function failureAnswerCode(answer: string): RevisionApiErrorCode | null {
  const normalized = answer.trim().toLowerCase();
  if (!normalized) return "invalid_response";
  if (
    normalized === REVISION_MATERIAL_NOT_FOUND.toLowerCase()
    || normalized.includes("material not found")
  ) return "material_missing";
  if (
    normalized.includes("ai service encountered an error")
    || normalized.includes("could not complete that response")
  ) return "service_unavailable";
  return null;
}

function normalizeError(error: unknown): RevisionApiError {
  if (error instanceof RevisionApiError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new RevisionApiError("This request was cancelled.", "timeout");
  }
  if (error instanceof ApiRequestError) {
    if (error.status === 401 || error.status === 403) {
      return new RevisionApiError("Your learning session has expired. Please sign in again.", "auth_required", error.status);
    }
    if (error.status === 404) {
      return new RevisionApiError(REVISION_MATERIAL_NOT_FOUND, "material_missing", error.status);
    }
    if (error.status === 429) {
      return new RevisionApiError("Revision generation is busy right now. Please wait a moment and try again.", "rate_limited", error.status);
    }
    if (error.status >= 500 || error.status === 0) {
      return new RevisionApiError("Revision material is temporarily unavailable. Your place is safe.", "service_unavailable", error.status);
    }
    return new RevisionApiError(error.message, "invalid_response", error.status);
  }
  if (error instanceof Error && error.name === "AbortError") {
    return new RevisionApiError("This request was cancelled.", "timeout");
  }
  return new RevisionApiError(
    error instanceof Error && error.message ? error.message : "Revision material could not be prepared.",
    "service_unavailable",
  );
}

async function generateRevisionPart(
  context: RevisionRequestContext,
  scope: RevisionContentScope,
  signal?: AbortSignal,
) {
  const response = await apiJson<{ answer?: unknown }>(`${backendURL(context.backendURL)}/section-ai`, {
    method: "POST",
    headers: await context.getAuthHeaders(),
    retries: 0,
    // A cold provider may use its configured fallback route after retrieval.
    // Keep the browser deadline above the backend's bounded provider window.
    timeoutMs: 70000,
    signal,
    forceFresh: true,
    body: JSON.stringify({
      question: `Teach ${scope.topicLabel} thoroughly from the selected material, including the core idea, how it works, an example, important relationships, common mistakes, exam relevance, and concise notes to remember when available.`,
      section_id: scope.topicId,
      session_id: ownedSessionId(context.userId, scope.topicId, "explain"),
      mode: "explain",
      difficulty: "medium",
      subject: scope.subject,
      chapter: scope.chapterLabel,
      topic: scope.topicLabel,
      strict_grounding: true,
      retrieval_required: true,
      fallback_to_general_knowledge: false,
      required_not_found_response: REVISION_MATERIAL_NOT_FOUND,
    }),
  });

  const answer = typeof response?.answer === "string" ? response.answer.trim() : "";
  const failureCode = failureAnswerCode(answer);
  if (failureCode === "material_missing") {
    throw new RevisionApiError(REVISION_MATERIAL_NOT_FOUND, failureCode, 404);
  }
  if (failureCode === "service_unavailable") {
    throw new RevisionApiError("Revision material is temporarily unavailable. Your place is safe.", failureCode, 503);
  }
  if (failureCode) {
    throw new RevisionApiError("The Revision Lab received an empty response. Please try again.", failureCode);
  }
  return answer;
}

/**
 * Build a short note sheet only from the grounded explanation that was already
 * returned. This avoids a second quota-charged AI request and never invents a
 * new fact. The full explanation remains the source of truth in the UI.
 */
export function buildRevisionNotes(explanation: string) {
  const source = String(explanation || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (!source) return "";

  const notes: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    const cleaned = value
      .replace(/^\s*[-*+]\s+/, "")
      .replace(/^\s*#{1,6}\s+/, "")
      .replace(/\s+/g, " ")
      .trim();
    const key = cleaned.toLowerCase();
    if (cleaned.length < 18 || seen.has(key)) return;
    seen.add(key);
    notes.push(cleaned);
  };

  source.split("\n").forEach((line) => {
    if (/^\s*[-*+]\s+\S/.test(line)) push(line);
  });

  if (notes.length < 4) {
    const prose = source
      .replace(/```[\s\S]*?```/g, " ")
      .split(/\n{2,}/)
      .map((block) => block.replace(/^\s*#{1,6}\s+[^\n]+\n?/, "").trim())
      .filter(Boolean);
    prose.forEach((block) => {
      const firstSentence = block.match(/^(.{18,260}?[.!?])(?:\s|$)/)?.[1] || block.slice(0, 260);
      push(firstSentence);
    });
  }

  return notes.slice(0, 7).map((note) => `- ${note}`).join("\n");
}

export async function generateRevisionLesson(
  context: RevisionRequestContext,
  scope: RevisionContentScope,
  signal?: AbortSignal,
): Promise<RevisionLessonPack> {
  try {
    const explanation = await generateRevisionPart(context, scope, signal);
    const notes = buildRevisionNotes(explanation);
    return {
      explanation,
      notes,
      generatedAt: new Date().toISOString(),
      partial: !notes,
    };
  } catch (error) {
    throw normalizeError(error);
  }
}

export function artifactHasContent(artifact?: StudyArtifact | null) {
  if (!artifact) return false;
  if (artifact.type === "concept_map") return Boolean(artifact.nodes?.length);
  if (artifact.type === "flip_cards") return Boolean(artifact.cards?.length);
  if (artifact.type === "formula_lab") return Boolean(artifact.formulas?.length);
  if (artifact.type === "mistake_cards") return Boolean(artifact.mistakes?.length);
  return false;
}

export function isUsableArtifactResponse(response?: StudyArtifactResponse | null) {
  return Boolean(response && Array.isArray(response.artifacts) && response.artifacts.some(artifactHasContent));
}

export async function generateRevisionArtifacts(
  context: RevisionRequestContext,
  scope: RevisionContentScope,
  signal?: AbortSignal,
): Promise<StudyArtifactResponse> {
  try {
    const response = await apiJson<StudyArtifactResponse>(`${backendURL(context.backendURL)}/artifacts/generate`, {
      method: "POST",
      headers: await context.getAuthHeaders(),
      retries: 0,
      timeoutMs: 20000,
      signal,
      forceFresh: true,
      body: JSON.stringify({
        section_id: scope.topicId,
        topic: scope.topicLabel,
        subject: scope.subject,
        chapter: scope.chapterLabel,
        artifact_type: "auto",
        strict_grounding: true,
        retrieval_required: true,
        fallback_to_general_knowledge: false,
        required_not_found_response: REVISION_MATERIAL_NOT_FOUND,
      }),
    });
    if (!isUsableArtifactResponse(response)) {
      throw new RevisionApiError("Study tools are not available for this topic yet.", "material_missing", 404);
    }
    return response;
  } catch (error) {
    throw normalizeError(error);
  }
}

export function revisionErrorMessage(error: unknown) {
  return normalizeError(error).message;
}
