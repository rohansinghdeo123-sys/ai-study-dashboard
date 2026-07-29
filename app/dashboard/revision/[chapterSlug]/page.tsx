"use client";

import RichMarkdown from "@/components/RichMarkdown";
import { RevisionScreen, RevisionStatusMessage } from "@/components/revision/RevisionScreen";
import { AppIcon } from "@/components/ui/Polished";
import { useAuth } from "@/context/AuthContext";
import {
  generateRevisionLesson,
  revisionErrorMessage,
  type RevisionLessonPack,
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
  readRevisionLesson,
  readRevisionProgress,
  readRevisionRecallDraft,
  revisionScopeKey,
  updateRevisionTrail,
  writeRevisionLesson,
  writeRevisionRecallDraft,
  type RevisionProgress,
  type RevisionTopicStatus,
} from "@/features/revision/storage";
import { useCatalog } from "@/lib/catalog";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./session.module.css";

type CheckStage = "write" | "compare" | "complete";

function statusLabel(status?: RevisionTopicStatus) {
  if (status === "reviewed") return "Self-reviewed";
  if (status === "needs_review") return "Needs another pass";
  if (status === "reviewing") return "In progress";
  return "Not started";
}

export default function RevisionSessionPage() {
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
  const selectedIndex = Math.max(0, selectedChapter?.topics.findIndex((topic) => topic.value === selectedTopic?.value) ?? 0);
  const previousTopic = selectedIndex > 0 ? selectedChapter?.topics[selectedIndex - 1] : null;
  const nextTopic = selectedChapter && selectedIndex < selectedChapter.topics.length - 1
    ? selectedChapter.topics[selectedIndex + 1]
    : null;
  const currentScope = {
    chapter: selectedChapter?.value || scope.chapter,
    topic: selectedTopic?.value || scope.topic,
  };
  const scopeKey = revisionScopeKey(currentScope.chapter, currentScope.topic);

  const [lesson, setLesson] = useState<RevisionLessonPack | null>(null);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<RevisionProgress | null>(null);
  const [recallDraft, setRecallDraft] = useState("");
  const [checkStage, setCheckStage] = useState<CheckStage>("write");

  const requestAbortRef = useRef<AbortController | null>(null);
  const requestInFlightRef = useRef(false);
  const activeScopeRef = useRef(scopeKey);
  const autoRequestedRef = useRef("");
  activeScopeRef.current = scopeKey;

  const reviewedCount = selectedChapter?.topics.reduce((count, topic) => {
    return count + (progress?.topics[revisionScopeKey(currentScope.chapter, topic.value)]?.status === "reviewed" ? 1 : 0);
  }, 0) || 0;
  const topicCount = selectedChapter?.topics.length || 1;
  const chapterProgress = Math.round((reviewedCount / topicCount) * 100);
  const currentStatus = progress?.topics[scopeKey]?.status;

  const requestLesson = useCallback(async () => {
    if (catalogPending || !userId || authLoading || !selectedChapter || !selectedTopic || requestInFlightRef.current) return;
    const requestedKey = revisionScopeKey(selectedChapter.value, selectedTopic.value);
    const controller = new AbortController();
    requestAbortRef.current?.abort();
    requestAbortRef.current = controller;
    requestInFlightRef.current = true;
    setLoadingLesson(true);
    setError("");

    try {
      const nextLesson = await generateRevisionLesson(
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
      setLesson(nextLesson);
      writeRevisionLesson(userId, selectedChapter.value, selectedTopic.value, nextLesson);
      if (nextLesson.partial) {
        setProgress(updateRevisionTrail(userId, selectedChapter.value, selectedTopic.value, "needs_review"));
      }
    } catch (requestError) {
      if (controller.signal.aborted || activeScopeRef.current !== requestedKey) return;
      setError(revisionErrorMessage(requestError));
    } finally {
      if (activeScopeRef.current === requestedKey) setLoadingLesson(false);
      if (requestAbortRef.current === controller) {
        requestAbortRef.current = null;
        requestInFlightRef.current = false;
      }
    }
  }, [authLoading, catalogPending, getAuthHeaders, selectedChapter, selectedTopic, userId]);

  useEffect(() => {
    if (catalogPending || !selectedChapter || !selectedTopic) return;
    if (requested.chapter !== selectedChapter.value || requested.topic !== selectedTopic.value) {
      router.replace(revisionLessonHref({ chapter: selectedChapter.value, topic: selectedTopic.value }), { scroll: false });
    }
  }, [catalogPending, requested, router, selectedChapter, selectedTopic]);

  useEffect(() => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    requestInFlightRef.current = false;
    setError("");
    setCheckStage("write");

    if (catalogPending || !userId || !selectedChapter || !selectedTopic) {
      setLesson(null);
      setRecallDraft("");
      return;
    }

    const cached = readRevisionLesson(userId, selectedChapter.value, selectedTopic.value);
    setLesson(cached);
    setRecallDraft(readRevisionRecallDraft(userId, selectedChapter.value, selectedTopic.value));

    const current = readRevisionProgress(userId);
    const previousStatus = current.topics[scopeKey]?.status;
    const nextProgress = updateRevisionTrail(
      userId,
      selectedChapter.value,
      selectedTopic.value,
      cached?.partial ? "needs_review" : previousStatus || "reviewing",
    );
    setProgress(nextProgress);

    let autoTimer = 0;
    if (!cached && !authLoading && autoRequestedRef.current !== scopeKey) {
      autoTimer = window.setTimeout(() => {
        autoRequestedRef.current = scopeKey;
        void requestLesson();
      }, 0);
    }

    return () => {
      if (autoTimer) window.clearTimeout(autoTimer);
      requestAbortRef.current?.abort();
    };
  }, [authLoading, catalogPending, requestLesson, scopeKey, selectedChapter, selectedTopic, userId]);

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
    if (chapter && topic) router.push(revisionLessonHref({ chapter: chapter.value, topic: topic.value }));
  };

  const saveRecallDraft = (answer: string) => {
    setRecallDraft(answer);
    if (userId) writeRevisionRecallDraft(userId, currentScope.chapter, currentScope.topic, answer);
  };

  const setTopicStatus = (status: RevisionTopicStatus) => {
    if (!userId || (status === "reviewed" && lesson?.partial)) return;
    const next = updateRevisionTrail(userId, currentScope.chapter, currentScope.topic, status);
    setProgress(next);
    setCheckStage("complete");
  };

  const topicList = selectedChapter?.topics.map((topic, index) => {
    const itemKey = revisionScopeKey(currentScope.chapter, topic.value);
    const status = progress?.topics[itemKey]?.status;
    const active = topic.value === selectedTopic?.value;
    return (
      <Link
        key={topic.value}
        href={revisionLessonHref({ chapter: currentScope.chapter, topic: topic.value })}
        className={styles.topicLink}
        data-active={active ? "true" : "false"}
        data-status={status || "not_started"}
        aria-current={active ? "step" : undefined}
      >
        <span className={styles.topicNumber}>{String(index + 1).padStart(2, "0")}</span>
        <span className={styles.topicCopy}>
          <strong>{topic.label}</strong>
          <small>{statusLabel(status)}</small>
        </span>
        <span className={styles.topicMarker} aria-hidden="true">
          {status === "reviewed" ? <AppIcon name="check" /> : null}
        </span>
      </Link>
    );
  });

  if (catalogPending) {
    return (
      <RevisionScreen
        eyebrow="Revision Lab / Loading syllabus"
        title="Opening your chapter…"
        description="Checking the published course catalog before preparing any revision material."
        backHref={revisionHomeHref(requested)}
      >
        <div className={styles.lessonSkeleton} role="status" aria-live="polite">
          <div className={styles.skeletonHeading}>
            <span className={styles.pulse} />
            <div><strong>Loading the published chapter</strong><small>Your deep link and selected topic will stay intact.</small></div>
          </div>
          <span /><span /><span /><span /><span />
        </div>
      </RevisionScreen>
    );
  }

  return (
    <RevisionScreen
      eyebrow="Real Revision / Guided chapter path"
      title={labels.topic}
      description={`Understand ${labels.topic} clearly, capture the notes that matter, and check whether you can explain it before moving on.`}
      backHref={revisionHomeHref(currentScope)}
      progress={(
        <div className={styles.progressPill}>
          <div>
            <span>{reviewedCount} of {topicCount} topics reviewed</span>
            <strong>{chapterProgress}%</strong>
          </div>
          <span
            className={styles.progressTrack}
            role="progressbar"
            aria-label={`${labels.chapter} topics reviewed on this device`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={chapterProgress}
          >
            <span style={{ width: `${chapterProgress}%` }} />
          </span>
        </div>
      )}
      actions={(
        <Link href={revisionToolsHref(currentScope)} className={styles.toolsLink}>
          <AppIcon name="mission" />
          Study Tools
        </Link>
      )}
    >
      <div className={styles.workspace}>
        <aside className={styles.rail} aria-label="Chapter revision outline">
          <div className={styles.railHeader}>
            <p>Chapter outline</p>
            <h2>{labels.chapter}</h2>
            <span>Move in order or open the exact topic you need.</span>
          </div>

          <label className={styles.chapterSelect}>
            <span>Change chapter</span>
            <select value={currentScope.chapter} onChange={(event) => changeChapter(event.target.value)}>
              {chapters.map((chapter) => (
                <option key={chapter.value} value={chapter.value}>{chapter.label}</option>
              ))}
            </select>
          </label>

          <nav className={styles.topicList} aria-label={`${labels.chapter} topics`}>
            {topicList}
          </nav>

          <div className={styles.railNote}>
            <AppIcon name="book" />
            <span>Progress here means reviewed on this device, not verified mastery.</span>
          </div>
        </aside>

        <details className={styles.mobileOutline}>
          <summary>
            <span><AppIcon name="panelLeft" /> Chapter outline</span>
            <strong>{selectedIndex + 1} / {topicCount}</strong>
          </summary>
          <label className={styles.chapterSelect}>
            <span>Change chapter</span>
            <select value={currentScope.chapter} onChange={(event) => changeChapter(event.target.value)}>
              {chapters.map((chapter) => (
                <option key={chapter.value} value={chapter.value}>{chapter.label}</option>
              ))}
            </select>
          </label>
          <nav className={styles.mobileTopicList} aria-label={`${labels.chapter} topics`}>
            {topicList}
          </nav>
        </details>

        <div className={styles.lessonColumn}>
          {error ? (
            <RevisionStatusMessage tone="error">
              <strong>We could not prepare this revision yet.</strong>
              <span>{error}</span>
              <button type="button" onClick={() => void requestLesson()} disabled={loadingLesson}>Try again</button>
            </RevisionStatusMessage>
          ) : null}

          {lesson?.partial ? (
            <RevisionStatusMessage tone="warning">
              One supporting section is temporarily unavailable. You can study what is ready now, but this topic cannot be self-reviewed until both sections are available.
            </RevisionStatusMessage>
          ) : null}

          {!lesson && loadingLesson ? (
            <div className={styles.lessonSkeleton} role="status" aria-live="polite">
              <div className={styles.skeletonHeading}>
                <span className={styles.pulse} />
                <div><strong>Preparing your guided revision</strong><small>Building the explanation and notes from your selected material.</small></div>
              </div>
              <span /><span /><span /><span /><span />
            </div>
          ) : null}

          {!lesson && !loadingLesson && !error ? (
            <div className={styles.emptyLesson}>
              <span><AppIcon name="book" /></span>
              <p>Guided revision</p>
              <h2>Build a clear lesson for {labels.topic}</h2>
              <p>The lesson will combine a teacher-style explanation with concise notes from the selected study material.</p>
              <button type="button" onClick={() => void requestLesson()}>
                Prepare revision
                <AppIcon name="spark" />
              </button>
            </div>
          ) : null}

          {lesson ? (
            <article className={styles.lessonCard} aria-labelledby="revision-document-title">
              <header className={styles.documentHeader}>
                <div>
                  <span className={styles.documentIcon}><AppIcon name="book" /></span>
                  <div>
                    <p>Guided revision lesson</p>
                    <h2 id="revision-document-title">{labels.topic}</h2>
                    <span>{labels.chapter} · Topic {selectedIndex + 1} of {topicCount}</span>
                  </div>
                </div>
                <button type="button" className={styles.refreshButton} onClick={() => void requestLesson()} disabled={loadingLesson}>
                  <AppIcon name={loadingLesson ? "clock" : "spark"} />
                  {loadingLesson ? "Refreshing" : "Refresh lesson"}
                </button>
              </header>

              {lesson.explanation ? (
                <section className={styles.explanationSection} aria-labelledby="understand-heading">
                  <div className={styles.sectionHeading}>
                    <span>01</span>
                    <div>
                      <p>Understand</p>
                      <h3 id="understand-heading">Build a clear picture</h3>
                    </div>
                  </div>
                  <RichMarkdown content={lesson.explanation} className={styles.revisionMarkdown} />
                </section>
              ) : (
                <RevisionStatusMessage tone="warning">The detailed explanation is unavailable, but your revision notes are ready below.</RevisionStatusMessage>
              )}

              {lesson.notes ? (
                <section className={styles.notesSection} aria-labelledby="remember-heading">
                  <div className={styles.sectionHeading}>
                    <span>02</span>
                    <div>
                      <p>Remember</p>
                      <h3 id="remember-heading">Notes worth carrying into the exam</h3>
                    </div>
                  </div>
                  <RichMarkdown content={lesson.notes} className={styles.notesMarkdown} />
                </section>
              ) : (
                <RevisionStatusMessage tone="warning">Concise notes are unavailable right now. The explanation above is still grounded in your material.</RevisionStatusMessage>
              )}

              <section className={styles.memorySection} aria-labelledby="memory-heading">
                <div className={styles.sectionHeading}>
                  <span>03</span>
                  <div>
                    <p>Check your memory</p>
                    <h3 id="memory-heading">Can you explain it without copying?</h3>
                  </div>
                </div>

                <div className={styles.memoryPrompt}>
                  <p>
                    In your own words, explain <strong>{labels.topic}</strong>, how the central idea works, and one detail an examiner should see in your answer.
                  </p>
                  <label>
                    <span>Your explanation</span>
                    <textarea
                      value={recallDraft}
                      onChange={(event) => saveRecallDraft(event.target.value)}
                      placeholder="Write what you remember before looking back…"
                      rows={5}
                    />
                  </label>

                  {checkStage === "write" ? (
                    <button
                      type="button"
                      className={styles.compareButton}
                      disabled={recallDraft.trim().length < 20}
                      onClick={() => setCheckStage("compare")}
                    >
                      Compare with the lesson
                      <AppIcon name="arrowRight" />
                    </button>
                  ) : null}

                  {checkStage === "compare" ? (
                    <div className={styles.selfReview} role="group" aria-label="Self-review result">
                      <div>
                        <strong>Compare it with the lesson above.</strong>
                        <span>Did you include the core meaning, how it works, and one correct example, relationship, or caution?</span>
                      </div>
                      <div>
                        <button type="button" onClick={() => setTopicStatus("needs_review")}>I need another pass</button>
                        <button
                          type="button"
                          onClick={() => setTopicStatus("reviewed")}
                          disabled={lesson.partial}
                          title={lesson.partial ? "The explanation and notes must both be ready before this topic can be self-reviewed." : undefined}
                        >
                          <AppIcon name="check" /> I can explain it
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {checkStage === "complete" ? (
                    <div className={styles.checkResult} data-status={currentStatus || "reviewing"} role="status">
                      <AppIcon name={currentStatus === "reviewed" ? "check" : "history"} />
                      <div>
                        <strong>{currentStatus === "reviewed" ? "Self-review saved" : "Saved for another pass"}</strong>
                        <span>{currentStatus === "reviewed" ? "Move ahead while the explanation is fresh." : "Your place is saved. Re-read the weak part, then try the check again."}</span>
                      </div>
                      {currentStatus === "needs_review" ? <button type="button" onClick={() => setCheckStage("write")}>Try again</button> : null}
                    </div>
                  ) : null}
                </div>
              </section>

              <footer className={styles.documentFooter}>
                <div>
                  <span>Grounded revision</span>
                  <small>Generated {new Date(lesson.generatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</small>
                </div>
                <div>
                  {previousTopic ? (
                    <Link href={revisionLessonHref({ chapter: currentScope.chapter, topic: previousTopic.value })} className={styles.previousLink}>
                      <AppIcon name="arrowRight" /> Previous
                    </Link>
                  ) : null}
                  {nextTopic ? (
                    <Link href={revisionLessonHref({ chapter: currentScope.chapter, topic: nextTopic.value })} className={styles.nextLink}>
                      Next topic <AppIcon name="arrowRight" />
                    </Link>
                  ) : (
                    <Link href={revisionHomeHref(currentScope)} className={styles.nextLink}>
                      Chapter overview <AppIcon name="arrowRight" />
                    </Link>
                  )}
                </div>
              </footer>
            </article>
          ) : null}
        </div>
      </div>
    </RevisionScreen>
  );
}
