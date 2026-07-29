import type { StudyArtifactResponse } from "@/features/study/types";
import type { RevisionLessonPack } from "@/features/revision/api";

export const REVISION_PROGRESS_VERSION = 1;

export type RevisionTopicStatus = "reviewing" | "reviewed" | "needs_review";

export type RevisionTopicTrail = {
  status: RevisionTopicStatus;
  lastOpenedAt: string;
};

export type RevisionProgress = {
  version: typeof REVISION_PROGRESS_VERSION;
  userId: string;
  updatedAt: string;
  lastChapter: string;
  lastTopic: string;
  topics: Record<string, RevisionTopicTrail>;
};

function progressKey(userId: string) {
  return `agentifyai:revision:progress:v${REVISION_PROGRESS_VERSION}:${userId}`;
}

export function revisionScopeKey(chapter: string, topic: string) {
  return `${chapter}:${topic}`;
}

function emptyProgress(userId: string): RevisionProgress {
  return {
    version: REVISION_PROGRESS_VERSION,
    userId,
    updatedAt: new Date(0).toISOString(),
    lastChapter: "",
    lastTopic: "",
    topics: {},
  };
}

export function readRevisionProgress(userId: string): RevisionProgress {
  if (!userId || typeof window === "undefined") return emptyProgress(userId);
  try {
    const parsed = JSON.parse(window.localStorage.getItem(progressKey(userId)) || "null") as Partial<RevisionProgress> | null;
    if (
      !parsed
      || parsed.version !== REVISION_PROGRESS_VERSION
      || parsed.userId !== userId
      || !parsed.topics
      || typeof parsed.topics !== "object"
    ) {
      return emptyProgress(userId);
    }
    return {
      ...emptyProgress(userId),
      ...parsed,
      version: REVISION_PROGRESS_VERSION,
      userId,
      topics: parsed.topics as Record<string, RevisionTopicTrail>,
    };
  } catch {
    return emptyProgress(userId);
  }
}

export function writeRevisionProgress(progress: RevisionProgress) {
  if (!progress.userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(progressKey(progress.userId), JSON.stringify(progress));
  } catch {
    // Device storage is an enhancement; the workspace must remain usable without it.
  }
}

export function updateRevisionTrail(
  userId: string,
  chapter: string,
  topic: string,
  status: RevisionTopicStatus,
) {
  const current = readRevisionProgress(userId);
  const now = new Date().toISOString();
  const next: RevisionProgress = {
    ...current,
    updatedAt: now,
    lastChapter: chapter,
    lastTopic: topic,
    topics: {
      ...current.topics,
      [revisionScopeKey(chapter, topic)]: { status, lastOpenedAt: now },
    },
  };
  writeRevisionProgress(next);
  return next;
}

type ResourceKind = "lesson" | "artifacts" | "recall";

function resourceKey(
  kind: ResourceKind,
  userId: string,
  chapter: string,
  topic: string,
) {
  return `agentifyai:revision:${kind}:v1:${userId}:${chapter}:${topic}`;
}

function readSessionResource<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.sessionStorage.getItem(key) || "null") as T | null;
  } catch {
    return null;
  }
}

function writeSessionResource(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A fresh request remains available if session storage is full or disabled.
  }
}

export function readRevisionLesson(
  userId: string,
  chapter: string,
  topic: string,
) {
  const lesson = readSessionResource<RevisionLessonPack>(resourceKey("lesson", userId, chapter, topic));
  if (!lesson || (!lesson.explanation && !lesson.notes)) return null;
  return lesson;
}

export function writeRevisionLesson(
  userId: string,
  chapter: string,
  topic: string,
  lesson: RevisionLessonPack,
) {
  writeSessionResource(resourceKey("lesson", userId, chapter, topic), lesson);
}

export function readRevisionArtifacts(
  userId: string,
  chapter: string,
  topic: string,
) {
  const response = readSessionResource<StudyArtifactResponse>(resourceKey("artifacts", userId, chapter, topic));
  if (!response || !Array.isArray(response.artifacts)) return null;
  return response;
}

export function writeRevisionArtifacts(
  userId: string,
  chapter: string,
  topic: string,
  response: StudyArtifactResponse,
) {
  writeSessionResource(resourceKey("artifacts", userId, chapter, topic), response);
}

export function readRevisionRecallDraft(
  userId: string,
  chapter: string,
  topic: string,
) {
  const draft = readSessionResource<{ answer?: unknown }>(resourceKey("recall", userId, chapter, topic));
  return typeof draft?.answer === "string" ? draft.answer : "";
}

export function writeRevisionRecallDraft(
  userId: string,
  chapter: string,
  topic: string,
  answer: string,
) {
  writeSessionResource(resourceKey("recall", userId, chapter, topic), { answer });
}
