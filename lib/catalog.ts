"use client";

/**
 * Shared course catalog for Study Lab, Exam Mode, and Missions.
 *
 * Chapters come from the backend `GET /catalog` (admin-published content).
 * The built-in list renders instantly and remains the safety net when the
 * request fails or nothing is published yet - a student never sees empty
 * chapter selectors. This module is the ONLY place the frontend defines
 * course structure; pages must not hard-code chapter lists.
 */

import { useAuth } from "@/context/AuthContext";
import { apiJson } from "@/lib/apiClient";
import { useEffect, useState } from "react";

export type CatalogTopic = { label: string; value: string };
export type CatalogChapter = { label: string; value: string; topics: CatalogTopic[] };

export const BUILTIN_CHAPTERS: CatalogChapter[] = [
  {
    label: "Hydrocarbons",
    value: "hydrocarbon",
    topics: [
      { label: "Alkanes", value: "alkanes" },
      { label: "Alkenes", value: "alkenes" },
      { label: "Alkynes", value: "alkynes" },
      { label: "Aromatic Hydrocarbons", value: "aromatics" },
    ],
  },
  {
    label: "Basic Concepts of Chemistry",
    value: "matter",
    topics: [
      { label: "Definition of Chemistry", value: "chemistry_definition" },
      { label: "Alchemy and Iatrochemistry", value: "historical_alchemy" },
      { label: "Ancient Indian Chemistry", value: "ancient_indian_chemistry" },
      { label: "Role and Importance of Chemistry", value: "importance_of_chemistry" },
      { label: "Matter Definition", value: "matter_definition" },
      { label: "Properties of Matter", value: "properties_of_matter" },
      { label: "States of Matter", value: "states_of_matter" },
      { label: "Solid State", value: "solid_state" },
      { label: "Liquid State", value: "liquid_state" },
      { label: "Gaseous State", value: "gaseous_state" },
      { label: "Interconversion of States", value: "interconversion_of_states" },
      { label: "Classification of Matter", value: "classification_of_matter" },
    ],
  },
];

export function findChapterForTopic(chapters: CatalogChapter[], topicValue: string): string {
  const normalized = topicValue
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (
    chapters.find((chapter) => chapter.topics.some((topic) => topic.value === normalized))?.value || ""
  );
}

/** Correct a (chapter, topic) pair against the active catalog. */
export function reconcileSelection(
  chapters: CatalogChapter[],
  chapterValue: string,
  topicValue: string,
): { chapter: string; topic: string; changed: boolean } {
  const fallback = chapters[0];
  const chapter = chapters.find((item) => item.value === chapterValue) || fallback;
  if (!chapter) return { chapter: chapterValue, topic: topicValue, changed: false };
  const topic = chapter.topics.find((item) => item.value === topicValue) || chapter.topics[0];
  const next = { chapter: chapter.value, topic: topic?.value || "" };
  return { ...next, changed: next.chapter !== chapterValue || next.topic !== topicValue };
}

type BackendCatalog = {
  source?: string;
  subjects?: Array<{
    subject?: string;
    class_level?: string;
    chapters?: Array<{
      slug?: string;
      name?: string;
      topics?: Array<{ id?: string; label?: string }>;
    }>;
  }>;
};

function mapBackendCatalog(payload: BackendCatalog, preferredClassLevel: string): CatalogChapter[] {
  const subjects = Array.isArray(payload?.subjects) ? payload.subjects : [];
  if (!subjects.length) return [];
  const preferred =
    subjects.find((group) => group.class_level && group.class_level === preferredClassLevel) ||
    subjects[0];
  const chapters = (preferred.chapters || [])
    .map((chapter) => ({
      label: String(chapter.name || chapter.slug || ""),
      value: String(chapter.slug || ""),
      topics: (chapter.topics || [])
        .map((topic) => ({ label: String(topic.label || topic.id || ""), value: String(topic.id || "") }))
        .filter((topic) => topic.value),
    }))
    .filter((chapter) => chapter.value && chapter.topics.length);
  return chapters;
}

export function useCatalog(): { chapters: CatalogChapter[]; source: "builtin" | "published" } {
  const { userId, loading, getAuthHeaders, profile } = useAuth();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  const [chapters, setChapters] = useState<CatalogChapter[]>(BUILTIN_CHAPTERS);
  const [source, setSource] = useState<"builtin" | "published">("builtin");
  const classLevel = profile?.classLevel || "";

  useEffect(() => {
    if (loading || !userId) return;
    let active = true;

    async function loadCatalog() {
      try {
        const payload = await apiJson<BackendCatalog>(`${backendURL}/catalog`, {
          headers: await getAuthHeaders(),
          cacheKey: "catalog",
          cacheTtlMs: 300000,
          retries: 1,
          timeoutMs: 8000,
        });
        if (!active || payload?.source !== "published") return;
        const mapped = mapBackendCatalog(payload, classLevel);
        if (mapped.length) {
          setChapters(mapped);
          setSource("published");
        }
      } catch {
        // Built-in catalog keeps every selector working.
      }
    }

    void loadCatalog();
    return () => {
      active = false;
    };
  }, [backendURL, classLevel, getAuthHeaders, loading, userId]);

  return { chapters, source };
}
