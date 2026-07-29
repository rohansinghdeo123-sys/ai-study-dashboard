"use client";

import RevisionArtifactWorkspace from "@/components/revision/RevisionArtifactWorkspace";
import { RevisionScreen, RevisionStatusMessage } from "@/components/revision/RevisionScreen";
import { AppIcon } from "@/components/ui/Polished";
import { useAuth } from "@/context/AuthContext";
import {
  generateRevisionArtifacts,
  revisionErrorMessage,
} from "@/features/revision/api";
import {
  getRevisionScopeLabels,
  readRevisionScope,
  resolveRevisionScope,
  revisionHomeHref,
  revisionLessonHref,
  revisionToolsHref,
} from "@/features/revision/routes";
import {
  readRevisionArtifacts,
  readRevisionProgress,
  revisionScopeKey,
  updateRevisionTrail,
  writeRevisionArtifacts,
} from "@/features/revision/storage";
import type { StudyArtifactResponse } from "@/features/study/types";
import { useCatalog } from "@/lib/catalog";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./tools.module.css";

export default function RevisionToolsPage() {
  const { userId, loading: authLoading, getAuthHeaders } = useAuth();
  const { chapters, settled: catalogSettled } = useCatalog();
  const params = useParams<{ chapterSlug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const requested = useMemo(
    () => readRevisionScope(searchParams, params.chapterSlug),
    [params.chapterSlug, searchParams],
  );
  const requestedExists = useMemo(
    () => chapters.some((chapter) => (
      chapter.value === requested.chapter
      && chapter.topics.some((topic) => topic.value === requested.topic)
    )),
    [chapters, requested],
  );
  const catalogPending = !catalogSettled && !requestedExists;
  const scope = useMemo(() => resolveRevisionScope(chapters, requested), [chapters, requested]);
  const selectedChapter = chapters.find((chapter) => chapter.value === scope.chapter) || chapters[0];
  const selectedTopic = selectedChapter?.topics.find((topic) => topic.value === scope.topic) || selectedChapter?.topics[0];
  const labels = getRevisionScopeLabels(chapters, scope);
  const currentScope = {
    chapter: selectedChapter?.value || scope.chapter,
    topic: selectedTopic?.value || scope.topic,
  };
  const scopeKey = revisionScopeKey(currentScope.chapter, currentScope.topic);

  const [artifacts, setArtifacts] = useState<StudyArtifactResponse | null>(null);
  const [loadingTools, setLoadingTools] = useState(false);
  const [error, setError] = useState("");
  const requestAbortRef = useRef<AbortController | null>(null);
  const requestInFlightRef = useRef(false);
  const activeScopeRef = useRef(scopeKey);
  activeScopeRef.current = scopeKey;

  const requestArtifacts = useCallback(async () => {
    if (catalogPending || !userId || authLoading || !selectedChapter || !selectedTopic || requestInFlightRef.current) return;
    const requestedKey = revisionScopeKey(selectedChapter.value, selectedTopic.value);
    const controller = new AbortController();
    requestAbortRef.current?.abort();
    requestAbortRef.current = controller;
    requestInFlightRef.current = true;
    setLoadingTools(true);
    setError("");

    try {
      const response = await generateRevisionArtifacts(
        { userId, getAuthHeaders },
        {
          subject: selectedChapter.subject || "Chemistry",
          chapterId: selectedChapter.value,
          chapterLabel: selectedChapter.label,
          topicId: selectedTopic.value,
          topicLabel: selectedTopic.label,
        },
        controller.signal,
      );
      if (controller.signal.aborted || activeScopeRef.current !== requestedKey) return;
      setArtifacts(response);
      writeRevisionArtifacts(userId, selectedChapter.value, selectedTopic.value, response);
    } catch (requestError) {
      if (controller.signal.aborted || activeScopeRef.current !== requestedKey) return;
      setError(revisionErrorMessage(requestError));
    } finally {
      if (activeScopeRef.current === requestedKey) setLoadingTools(false);
      if (requestAbortRef.current === controller) {
        requestAbortRef.current = null;
        requestInFlightRef.current = false;
      }
    }
  }, [authLoading, catalogPending, getAuthHeaders, selectedChapter, selectedTopic, userId]);

  useEffect(() => {
    if (catalogPending || !selectedChapter || !selectedTopic) return;
    if (requested.chapter !== selectedChapter.value || requested.topic !== selectedTopic.value) {
      router.replace(revisionToolsHref({ chapter: selectedChapter.value, topic: selectedTopic.value }), { scroll: false });
    }
  }, [catalogPending, requested, router, selectedChapter, selectedTopic]);

  useEffect(() => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    requestInFlightRef.current = false;
    setError("");

    if (catalogPending || !userId || !selectedChapter || !selectedTopic) {
      setArtifacts(null);
      return;
    }

    const cached = readRevisionArtifacts(userId, selectedChapter.value, selectedTopic.value);
    setArtifacts(cached);
    const current = readRevisionProgress(userId);
    updateRevisionTrail(
      userId,
      selectedChapter.value,
      selectedTopic.value,
      current.topics[scopeKey]?.status || "reviewing",
    );

    return () => {
      requestAbortRef.current?.abort();
    };
  }, [catalogPending, scopeKey, selectedChapter, selectedTopic, userId]);

  useEffect(() => () => requestAbortRef.current?.abort(), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>("[data-revision-scroll]")?.scrollTo({ top: 0 });
      document.getElementById("revision-screen-title")?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [catalogPending, scopeKey]);

  const changeChapter = (chapterValue: string) => {
    const chapter = chapters.find((candidate) => candidate.value === chapterValue);
    const topic = chapter?.topics[0];
    if (chapter && topic) router.push(revisionToolsHref({ chapter: chapter.value, topic: topic.value }));
  };

  const changeTopic = (topicValue: string) => {
    router.push(revisionToolsHref({ chapter: currentScope.chapter, topic: topicValue }));
  };

  const availableCount = artifacts?.artifacts.filter((artifact) => {
    if (artifact.type === "concept_map") return Boolean(artifact.nodes?.length);
    if (artifact.type === "flip_cards") return Boolean(artifact.cards?.length);
    if (artifact.type === "formula_lab") return Boolean(artifact.formulas?.length);
    if (artifact.type === "mistake_cards") return Boolean(artifact.mistakes?.length);
    return false;
  }).length || 0;

  if (catalogPending) {
    return (
      <RevisionScreen
        eyebrow="Revision Lab / Loading syllabus"
        title="Opening your study tools…"
        description="Checking the published course catalog before preparing any tool request."
        backHref={revisionHomeHref(requested)}
      >
        <div className={styles.toolsSkeleton} role="status" aria-live="polite">
          <div><span className={styles.pulse} /><p><strong>Loading the published chapter</strong><small>Your selected chapter and topic will stay intact.</small></p></div>
          <div className={styles.skeletonTabs}><span /><span /><span /><span /></div>
          <div className={styles.skeletonCanvas}><span /><span /><span /></div>
        </div>
      </RevisionScreen>
    );
  }

  return (
    <RevisionScreen
      eyebrow="Revision Lab / Study Tools"
      title={`Practise ${labels.topic} actively.`}
      description="Use the tool that fits the material: map the idea, retrieve it from memory, inspect formulas, or correct common mistakes."
      backHref={revisionHomeHref(currentScope)}
      progress={artifacts ? (
        <div className={styles.readyPill}>
          <AppIcon name="check" />
          <span><strong>{availableCount}</strong> tools ready</span>
        </div>
      ) : null}
      actions={(
        <Link href={revisionLessonHref(currentScope)} className={styles.lessonLink}>
          <AppIcon name="book" />
          Real Revision
        </Link>
      )}
    >
      <div className={styles.content}>
        <section className={styles.scopeBar} aria-label="Study tool topic">
          <div className={styles.scopeIdentity}>
            <span><AppIcon name="mission" /></span>
            <div>
              <small>Active workspace</small>
              <strong>{labels.topic}</strong>
              <span>{labels.chapter}</span>
            </div>
          </div>

          <div className={styles.selectors}>
            <label>
              <span>Chapter</span>
              <select value={currentScope.chapter} onChange={(event) => changeChapter(event.target.value)}>
                {chapters.map((chapter) => <option key={chapter.value} value={chapter.value}>{chapter.label}</option>)}
              </select>
            </label>
            <label>
              <span>Topic</span>
              <select value={currentScope.topic} onChange={(event) => changeTopic(event.target.value)}>
                {selectedChapter?.topics.map((topic) => <option key={topic.value} value={topic.value}>{topic.label}</option>)}
              </select>
            </label>
          </div>

          <button type="button" className={styles.refreshButton} onClick={() => void requestArtifacts()} disabled={loadingTools}>
            <AppIcon name={loadingTools ? "clock" : "spark"} />
            {loadingTools ? "Building tools" : artifacts ? "Refresh tools" : "Build tools"}
          </button>
        </section>

        {error ? (
          <RevisionStatusMessage tone="error">
            <strong>Study tools are unavailable for this topic.</strong>
            <span>{error}</span>
            <button type="button" onClick={() => void requestArtifacts()} disabled={loadingTools}>Try again</button>
          </RevisionStatusMessage>
        ) : null}

        {!artifacts && loadingTools ? (
          <div className={styles.toolsSkeleton} role="status" aria-live="polite">
            <div><span className={styles.pulse} /><p><strong>Building your study tools</strong><small>Reading the topic and choosing the useful tools.</small></p></div>
            <div className={styles.skeletonTabs}><span /><span /><span /><span /></div>
            <div className={styles.skeletonCanvas}><span /><span /><span /></div>
          </div>
        ) : null}

        {!artifacts && !loadingTools && !error ? (
          <div className={styles.emptyTools}>
            <span><AppIcon name="mission" /></span>
            <p>Active revision tools</p>
            <h2>Turn {labels.topic} into something you can use.</h2>
            <p>AgentifyAI will prepare only the tools supported by the selected material.</p>
            <button type="button" onClick={() => void requestArtifacts()}>Build study tools <AppIcon name="spark" /></button>
          </div>
        ) : null}

        {artifacts ? <RevisionArtifactWorkspace key={scopeKey} response={artifacts} /> : null}

        <p className={styles.disclosure}>Opening or revealing a tool does not mark a topic as mastered. Use Real Revision to record your self-check.</p>
      </div>
    </RevisionScreen>
  );
}
