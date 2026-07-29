"use client";

import { ExamScreen, ExamStatusMessage } from "@/components/exam/ExamScreen";
import { AppIcon } from "@/components/ui/Polished";
import { useAuth } from "@/context/AuthContext";
import { examApiRequest } from "@/features/exam/api";
import type {
  ExtractedQuestion,
  PaperAnalysis,
  PaperOut,
  PaperUploadResponse,
  PatternAnalysis,
} from "@/features/exam/contracts";
import {
  formatExamConfidence,
  formatExamDate,
  formatExamLabel,
  formatExamMarks,
  paperStatusCopy,
  toMetricEntries,
} from "@/features/exam/papersFormat";
import { DEFAULT_CLASS_LEVEL, SUBJECT } from "@/lib/examConfig";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../papers.module.css";

type DetailView = "overview" | "questions" | "analysis";

function isDetailView(value: string | null): value is DetailView {
  return value === "overview" || value === "questions" || value === "analysis";
}

function MetricCollection({ title, data }: { title: string; data: Record<string, string | number> }) {
  const entries = toMetricEntries(data);
  const maxValue = Math.max(1, ...entries.map((entry) => Number.parseFloat(String(entry.value)) || 0));
  return (
    <section className={styles.analysisCard}>
      <p>{title}</p>
      {entries.length ? (
        <div className={styles.metricRows}>
          {entries.map((entry) => {
            const numeric = Number.parseFloat(String(entry.value)) || 0;
            const width = Math.max(5, Math.round((numeric / maxValue) * 100));
            return (
              <div className={styles.metricRow} key={entry.label}>
                <span>{entry.label}</span>
                <div className={styles.metricTrack} aria-hidden="true"><i style={{ width: `${width}%` }} /></div>
                <strong>{String(entry.value)}</strong>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.warningList}><span>No data available</span></div>
      )}
    </section>
  );
}

export default function PaperDetailPage() {
  const params = useParams<{ paperId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, userId, loading, getAuthHeaders } = useAuth();
  const paperId = Number(params.paperId);
  const requestedView = searchParams.get("view");
  const activeView: DetailView = isDetailView(requestedView) ? requestedView : "overview";
  const classLevel = profile?.classLevel || DEFAULT_CLASS_LEVEL;

  const [paper, setPaper] = useState<PaperOut | null>(null);
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);
  const [pattern, setPattern] = useState<PatternAnalysis | null>(null);
  const [fetching, setFetching] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [analyzingPattern, setAnalyzingPattern] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const deleteDialogRef = useRef<HTMLElement>(null);
  const deletingRef = useRef(false);

  useEffect(() => {
    deletingRef.current = deleting;
  }, [deleting]);

  const preservedQuery = useMemo(() => {
    const query = new URLSearchParams();
    const chapter = searchParams.get("chapter");
    const topic = searchParams.get("topic");
    if (chapter) query.set("chapter", chapter);
    if (topic) query.set("topic", topic);
    return query.toString();
  }, [searchParams]);

  const loadDetail = useCallback(async () => {
    if (!userId || !Number.isInteger(paperId) || paperId <= 0) return;
    setFetching(true);
    setError("");
    try {
      const [detail, extracted] = await Promise.all([
        examApiRequest<{ paper: PaperOut; analysis: PaperAnalysis }>(`/exam/papers/${paperId}`, {
          getAuthHeaders,
          timeoutMs: 18000,
          forceFresh: true,
        }),
        examApiRequest<{ paper_id: number; count: number; questions: ExtractedQuestion[] }>(
          `/exam/papers/${paperId}/questions`,
          { getAuthHeaders, timeoutMs: 18000, forceFresh: true },
        ),
      ]);
      setPaper(detail.paper);
      setAnalysis(detail.analysis && Object.keys(detail.analysis).length ? detail.analysis : null);
      setQuestions(Array.isArray(extracted.questions) ? extracted.questions : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not open this paper.");
    } finally {
      setFetching(false);
    }
  }, [getAuthHeaders, paperId, userId]);

  useEffect(() => {
    if (loading || !userId) return;
    void loadDetail();
  }, [loadDetail, loading, userId]);

  useEffect(() => {
    if (!confirmDelete) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = deleteDialogRef.current;
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deletingRef.current) {
        event.preventDefault();
        setConfirmDelete(false);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeys);
    return () => {
      window.removeEventListener("keydown", handleDialogKeys);
      previouslyFocused?.focus();
    };
  }, [confirmDelete]);

  const setView = (view: DetailView) => {
    const query = new URLSearchParams(searchParams.toString());
    query.set("view", view);
    router.replace(`/dashboard/exam/papers/${paperId}?${query.toString()}`, { scroll: false });
  };

  const reanalyze = async () => {
    if (!paper || reanalyzing) return;
    setReanalyzing(true);
    setError("");
    setNotice("");
    try {
      const data = await examApiRequest<PaperUploadResponse>(`/exam/papers/${paperId}/reanalyze`, {
        getAuthHeaders,
        method: "POST",
        retries: 0,
        timeoutMs: 60000,
        invalidate: ["exam-papers", "exam-pattern", "exam-probable"],
        body: {
          class_level: classLevel,
          subject: SUBJECT,
          chapter_name: paper.chapter_name,
          exam_type: paper.exam_type,
        },
      });
      setPaper(data.paper);
      setAnalysis(data.analysis || null);
      setNotice(data.message || "Paper reanalysis is ready.");
      await loadDetail();
    } catch (reanalyzeError) {
      setError(reanalyzeError instanceof Error ? reanalyzeError.message : "Could not reanalyze this paper.");
    } finally {
      setReanalyzing(false);
    }
  };

  const analyzePaperPattern = async () => {
    if (!paper || analyzingPattern) return;
    setAnalyzingPattern(true);
    setError("");
    setNotice("");
    try {
      const result = await examApiRequest<PatternAnalysis>("/exam/pattern/analyze", {
        getAuthHeaders,
        method: "POST",
        retries: 0,
        timeoutMs: 60000,
        invalidate: ["exam-pattern", "exam-probable"],
        body: {
          paper_ids: [paperId],
          class_level: classLevel,
          subject: SUBJECT,
          chapter_name: paper.chapter_name,
        },
      });
      setPattern(result);
      setNotice("This paper’s pattern is ready. You can now use it in Probable Questions.");
      setView("analysis");
    } catch (patternError) {
      setError(patternError instanceof Error ? patternError.message : "Could not analyze this paper pattern.");
    } finally {
      setAnalyzingPattern(false);
    }
  };

  const deletePaper = async () => {
    if (!paper || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await examApiRequest<{ status: string; id: number }>(`/exam/papers/${paperId}`, {
        getAuthHeaders,
        method: "DELETE",
        retries: 0,
        timeoutMs: 18000,
        invalidate: ["exam-papers", "exam-pattern", "exam-probable"],
      });
      router.replace(`/dashboard/exam/papers${preservedQuery ? `?${preservedQuery}` : ""}`);
    } catch (deleteError) {
      setConfirmDelete(false);
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this paper.");
      setDeleting(false);
    }
  };

  const probableHref = pattern
    ? `/dashboard/exam/probable?${new URLSearchParams({
        ...(preservedQuery ? Object.fromEntries(new URLSearchParams(preservedQuery)) : {}),
        mode: "paper_pattern",
        analysis: String(pattern.id),
      }).toString()}`
    : `/dashboard/exam/probable${preservedQuery ? `?${preservedQuery}` : ""}`;

  if (!Number.isInteger(paperId) || paperId <= 0) {
    return (
      <ExamScreen eyebrow="Question paper lab" title="Paper not found" description="This paper link is not valid." backHref="/dashboard/exam/papers" backLabel="Paper library">
        <div className={styles.errorDetail}>
          <span><AppIcon name="x" /></span>
          <h3>Invalid paper link</h3>
          <p>Return to your library and choose a paper to continue.</p>
          <Link className={styles.secondaryButton} href="/dashboard/exam/papers">Open paper library</Link>
        </div>
      </ExamScreen>
    );
  }

  return (
    <ExamScreen
      eyebrow="Question paper lab"
      title={paper ? paper.paper_title || paper.file_name : "Opening paper…"}
      description="Inspect one paper at a time without losing your place in Exam Mode."
      backHref={`/dashboard/exam/papers${preservedQuery ? `?${preservedQuery}` : ""}`}
      backLabel="Paper library"
      actions={<Link href={probableHref} className={styles.headerLink}>Probable questions <AppIcon name="arrowRight" /></Link>}
    >
      <div className={styles.detailPage}>
        {error ? <ExamStatusMessage tone="error">{error}</ExamStatusMessage> : null}
        {notice ? <ExamStatusMessage tone="success">{notice}</ExamStatusMessage> : null}

        {fetching && !paper ? (
          <div className={styles.loadingBlock} aria-label="Loading paper"><span /><span /><span /></div>
        ) : paper ? (
          <>
            <section className={styles.detailHero}>
              <div className={styles.detailTitle}>
                <span><AppIcon name="book" /></span>
                <div>
                  <p>{formatExamLabel(paper.exam_type)}</p>
                  <h2>{paper.paper_title || paper.file_name}</h2>
                  <div className={styles.detailMeta}>
                    <span>{paper.file_name}</span>
                    <span>{formatExamDate(paper.uploaded_at)}</span>
                    <span>{paperStatusCopy(paper.parse_status)}</span>
                  </div>
                </div>
              </div>
              <div className={styles.detailActions}>
                <button className={styles.secondaryButton} type="button" onClick={() => void reanalyze()} disabled={reanalyzing}>
                  <AppIcon name="history" /> {reanalyzing ? "Reanalyzing…" : "Reanalyze"}
                </button>
                <button className={styles.primaryButton} type="button" onClick={() => void analyzePaperPattern()} disabled={analyzingPattern || paper.parse_status !== "analyzed"}>
                  <AppIcon name="analytics" /> {analyzingPattern ? "Analyzing…" : "Build pattern"}
                </button>
                <button className={styles.textButton} type="button" onClick={() => setConfirmDelete(true)}>
                  <AppIcon name="trash" /> Delete
                </button>
              </div>
            </section>

            <section className={styles.detailWorkspace}>
              <nav className={styles.tabs} aria-label="Paper detail views">
                {(["overview", "questions", "analysis"] as DetailView[]).map((view) => (
                  <button key={view} type="button" className={styles.tab} aria-pressed={activeView === view} data-active={activeView === view ? "true" : "false"} onClick={() => setView(view)}>
                    {view === "questions" ? `Extracted questions (${questions.length})` : formatExamLabel(view)}
                  </button>
                ))}
              </nav>

              <div className={styles.detailContent}>
                {activeView === "overview" ? (
                  <>
                    <div className={styles.overviewGrid}>
                      <article className={styles.metricCard}>
                        <span>Questions found</span>
                        <strong>{paper.extracted_question_count}</strong>
                        <small>Structured prompts</small>
                      </article>
                      <article className={styles.metricCard}>
                        <span>Total marks</span>
                        <strong>{formatExamMarks(analysis?.total_marks)}</strong>
                        <small>Across the paper</small>
                      </article>
                      <article className={styles.metricCard}>
                        <span>Extraction confidence</span>
                        <strong>{formatExamConfidence(paper.extraction_confidence)}</strong>
                        <small>Text interpretation</small>
                      </article>
                      <article className={styles.metricCard}>
                        <span>Chapter</span>
                        <strong>{paper.chapter_name || "--"}</strong>
                        <small>{paper.class_level || classLevel}</small>
                      </article>
                    </div>

                    <section className={styles.summaryCard}>
                      <p className={styles.eyebrow}>Paper reading</p>
                      <p>{analysis?.pattern_summary || (paper.parse_status === "analyzed" ? "The paper is ready. Open Analysis to inspect its mark, topic, and question-type distribution." : "This paper needs attention before reliable analysis is available.")}</p>
                    </section>

                    {paper.warnings?.length ? (
                      <section className={styles.analysisCard}>
                        <p>Reading notes</p>
                        <div className={styles.warningList}>{paper.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>
                      </section>
                    ) : null}
                  </>
                ) : null}

                {activeView === "questions" ? (
                  questions.length ? (
                    <div className={styles.questionsList}>
                      {questions.map((question, index) => (
                        <article className={styles.questionRow} key={question.id}>
                          <span className={styles.questionNumber}>{question.question_number || `Q${index + 1}`}</span>
                          <div className={styles.questionCopy}>
                            <h3>{question.question_text}</h3>
                            <p>{formatExamLabel(question.question_type)} · {formatExamLabel(question.difficulty)} · {question.topic || "Topic not tagged"}</p>
                          </div>
                          <span className={styles.questionMarks}>{formatExamMarks(question.marks)} marks</span>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyDetail}>
                      <span><AppIcon name="search" /></span>
                      <h3>No structured questions found</h3>
                      <p>Try reanalyzing a text-based PDF. Scanned documents may need OCR before questions can be extracted.</p>
                      <button className={styles.secondaryButton} type="button" onClick={() => void reanalyze()} disabled={reanalyzing}>Reanalyze paper</button>
                    </div>
                  )
                ) : null}

                {activeView === "analysis" ? (
                  analysis ? (
                    <>
                      <section className={styles.summaryCard}>
                        <p className={styles.eyebrow}>Observed pattern</p>
                        <p>{pattern?.pattern_summary || analysis.pattern_summary || "Distribution signals extracted from this paper."}</p>
                        {pattern ? (
                          <div className={styles.confirmActions}>
                            <Link className={styles.primaryButton} href={probableHref}>Use this pattern <AppIcon name="arrowRight" /></Link>
                          </div>
                        ) : null}
                      </section>
                      <div className={styles.analysisGrid}>
                        <MetricCollection title="Marks distribution" data={analysis.marks_distribution || {}} />
                        <MetricCollection title="Question types" data={analysis.question_type_distribution || {}} />
                        <MetricCollection title="Difficulty" data={analysis.difficulty_distribution || {}} />
                        <MetricCollection title="Topic frequency" data={analysis.topic_frequency || {}} />
                      </div>
                      <div className={styles.analysisGrid}>
                        <section className={styles.analysisCard}>
                          <p>Repeated concepts</p>
                          <div className={styles.chipList}>
                            {(analysis.repeated_concepts?.length ? analysis.repeated_concepts : analysis.high_frequency_concepts || []).map((concept) => <span key={String(concept)}>{String(concept)}</span>)}
                            {!analysis.repeated_concepts?.length && !analysis.high_frequency_concepts?.length ? <span>No repeated concepts yet</span> : null}
                          </div>
                        </section>
                        <MetricCollection title="Chapter weightage" data={analysis.chapter_weightage || {}} />
                      </div>
                    </>
                  ) : (
                    <div className={styles.emptyDetail}>
                      <span><AppIcon name="analytics" /></span>
                      <h3>Analysis is not ready</h3>
                      <p>Reanalyze this paper after confirming it contains readable text.</p>
                      <button className={styles.secondaryButton} type="button" onClick={() => void reanalyze()} disabled={reanalyzing}>Reanalyze paper</button>
                    </div>
                  )
                ) : null}
              </div>
            </section>
          </>
        ) : (
          <div className={styles.errorDetail}>
            <span><AppIcon name="x" /></span>
            <h3>We could not open this paper</h3>
            <p>It may have been removed, or the link may belong to another account.</p>
            <Link className={styles.secondaryButton} href={`/dashboard/exam/papers${preservedQuery ? `?${preservedQuery}` : ""}`}>Return to library</Link>
          </div>
        )}
      </div>

      {confirmDelete && paper ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setConfirmDelete(false); }}>
          <section ref={deleteDialogRef} className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="delete-paper-title" aria-describedby="delete-paper-description">
            <span><AppIcon name="trash" /></span>
            <h2 id="delete-paper-title">Delete this paper?</h2>
            <p id="delete-paper-description">“{paper.paper_title || paper.file_name}” and its extracted questions will be removed. Existing pattern intelligence may also change.</p>
            <div className={styles.confirmActions}>
              <button className={styles.secondaryButton} type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} autoFocus>Keep paper</button>
              <button className={styles.dangerButton} type="button" onClick={() => void deletePaper()} disabled={deleting}>{deleting ? "Deleting…" : "Delete permanently"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </ExamScreen>
  );
}
