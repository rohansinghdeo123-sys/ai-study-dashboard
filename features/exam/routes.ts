import { BUILTIN_CHAPTERS, findChapterForTopic, type CatalogChapter } from "@/lib/catalog";
import { normalizeTopicValue } from "./contracts";

export const EXAM_ROUTES = {
  home: "/dashboard/exam",
  mcq: "/dashboard/exam/mcq",
  probable: "/dashboard/exam/probable",
  papers: "/dashboard/exam/papers",
  workspace: "/dashboard/exam/workspace",
  history: "/dashboard/exam/workspace/history",
} as const;

export type ExamRoutePath = (typeof EXAM_ROUTES)[keyof typeof EXAM_ROUTES] | string;

export type ExamScope = {
  chapter: string;
  topic: string;
};

type SearchParamsReader = {
  get(name: string): string | null;
};

export const DEFAULT_EXAM_SCOPE: ExamScope = {
  chapter: "hydrocarbon",
  topic: "alkanes",
};

export function readExamScope(searchParams?: SearchParamsReader | null): ExamScope {
  const topic = normalizeTopicValue(searchParams?.get("topic") || DEFAULT_EXAM_SCOPE.topic)
    || DEFAULT_EXAM_SCOPE.topic;
  const requestedChapter = normalizeTopicValue(searchParams?.get("chapter") || "");
  const inferredChapter = findChapterForTopic(BUILTIN_CHAPTERS, topic);

  return {
    chapter: requestedChapter || inferredChapter || DEFAULT_EXAM_SCOPE.chapter,
    topic,
  };
}

export function examHref(
  route: ExamRoutePath,
  scope?: Partial<ExamScope> | null,
  extra?: Record<string, string | number | boolean | null | undefined>,
) {
  const params = new URLSearchParams();
  const chapter = normalizeTopicValue(scope?.chapter || "");
  const topic = normalizeTopicValue(scope?.topic || "");
  if (chapter) params.set("chapter", chapter);
  if (topic) params.set("topic", topic);
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `${route}?${query}` : route;
}

export function paperDetailHref(paperId: number, scope?: Partial<ExamScope> | null) {
  return examHref(`${EXAM_ROUTES.papers}/${paperId}`, scope);
}

export function writtenAttemptHref(attemptId: number, scope?: Partial<ExamScope> | null) {
  return examHref(`${EXAM_ROUTES.workspace}/attempts/${attemptId}`, scope);
}

export function getExamScopeLabels(chapters: CatalogChapter[], scope: ExamScope) {
  const chapter = chapters.find((candidate) => candidate.value === scope.chapter) || chapters[0];
  const topic = chapter?.topics.find((candidate) => candidate.value === scope.topic) || chapter?.topics[0];
  return {
    chapter: chapter?.label || scope.chapter.replace(/_/g, " "),
    topic: topic?.label || scope.topic.replace(/_/g, " "),
  };
}
