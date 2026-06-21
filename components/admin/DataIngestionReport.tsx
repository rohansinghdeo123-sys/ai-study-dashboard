"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/Polished";
import { HealthBadge } from "./HealthBadge";
import { MUTED, PANEL, SOFT_PANEL, TEXT, classifyHealth, formatCompact, formatPercent } from "./format";
import type { ContentReport, ReportChapter } from "./types";

const DIFFICULTY_LABEL = ["", "Very easy", "Easy", "Medium", "Hard", "Very hard"];

function TotalPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--agentify-border)] bg-[color:var(--agentify-hover-bg)] px-3.5 py-2.5">
      <p className={cn("text-[10px] font-bold uppercase tracking-[0.14em]", MUTED)}>{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tracking-tight", TEXT)}>{value}</p>
    </div>
  );
}

function ConceptTable({ chapter }: { chapter: ReportChapter }) {
  if (!chapter.concepts.length) {
    return <p className={cn("px-1 py-3 text-xs", MUTED)}>No concepts generated for this chapter yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left text-xs">
        <thead>
          <tr className={cn("text-[10px] font-bold uppercase tracking-[0.12em]", MUTED)}>
            <th className="px-2 py-2">Topic / concept</th>
            <th className="px-2 py-2">Difficulty</th>
            <th className="px-2 py-2">Importance</th>
            <th className="px-2 py-2">Exam weightage</th>
            <th className="px-2 py-2">Pages</th>
          </tr>
        </thead>
        <tbody>
          {chapter.concepts.map((concept) => (
            <tr key={concept.concept_id} className="border-t border-[color:var(--agentify-border)]">
              <td className={cn("px-2 py-2 font-medium", TEXT)}>
                {concept.title || concept.concept_id}
                {concept.validation_issues > 0 ? (
                  <span className="ml-2 rounded-full border border-[#F2B84B]/30 bg-[#F2B84B]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#B7791F]">
                    {concept.validation_issues} issue{concept.validation_issues === 1 ? "" : "s"}
                  </span>
                ) : null}
              </td>
              <td className={cn("px-2 py-2", MUTED)}>{DIFFICULTY_LABEL[concept.difficulty_level] || `L${concept.difficulty_level}`}</td>
              <td className={cn("px-2 py-2", MUTED)}>{concept.importance_level || "—"}</td>
              <td className={cn("px-2 py-2", MUTED)}>{concept.typical_exam_weightage || "—"}</td>
              <td className={cn("px-2 py-2", MUTED)}>{concept.source_pages.length ? concept.source_pages.join(", ") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {chapter.concepts_truncated ? (
        <p className={cn("mt-2 px-1 text-[11px]", MUTED)}>
          Showing the first {chapter.concepts.length} of {chapter.concept_count} concepts.
        </p>
      ) : null}
    </div>
  );
}

function ChapterRow({ chapter }: { chapter: ReportChapter }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn(SOFT_PANEL, "overflow-hidden")}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[color:var(--agentify-active-bg)]"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("truncate text-sm font-semibold", TEXT)}>{chapter.chapter_name || `Chapter ${chapter.chapter_number ?? ""}`}</p>
            <HealthBadge state={classifyHealth(chapter.status)} label={chapter.status} />
          </div>
          <p className={cn("mt-1 truncate text-[11px]", MUTED)}>
            Class {chapter.class_level || "—"} · {chapter.subject || "—"} · {chapter.concept_count} topics · {chapter.page_count} pages ·{" "}
            {chapter.embedded_chunks}/{chapter.chunk_count} chunks embedded · coverage {formatPercent(chapter.coverage_score)}
          </p>
        </div>
        <span className={cn("shrink-0 text-xs font-semibold", MUTED)}>{open ? "Hide" : "View topics"}</span>
      </button>
      {open ? <div className="border-t border-[color:var(--agentify-border)] px-4 py-3">
        <ConceptTable chapter={chapter} />
      </div> : null}
    </div>
  );
}

// Detailed, readable inventory of all ingested study data: subjects, classes,
// chapters, and their topics/concepts — plus the RAG "memory" (chunks/embeddings).
// Powered by the real GET /admin/content/ingestion-report endpoint.
export function DataIngestionReport({ report }: { report: ContentReport | null }) {
  const subjects = useMemo(() => Object.entries(report?.by_subject || {}).sort((a, b) => b[1] - a[1]), [report]);
  const classes = useMemo(() => Object.entries(report?.by_class || {}).sort((a, b) => b[1] - a[1]), [report]);

  if (!report) {
    return (
      <EmptyState
        icon="book"
        title="Ingestion report unavailable"
        detail="The content ingestion report could not be loaded from the backend. Ensure the content pipeline tables exist and try refresh."
      />
    );
  }

  if (!report.totals.chapters) {
    return (
      <EmptyState
        icon="book"
        title="No study content ingested yet"
        detail="Once chapters are ingested and approved, their subjects, topics, and concepts will appear here."
      />
    );
  }

  return (
    <div className={cn(PANEL, "p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={cn("text-sm font-semibold", TEXT)}>Ingested study data</p>
          <p className={cn("mt-0.5 text-xs", MUTED)}>
            {report.database_dialect} · embeddings {report.embeddings_enabled ? `on (${report.embeddings_model})` : "off"}
          </p>
        </div>
        <HealthBadge
          state={report.embeddings_enabled ? "healthy" : "warning"}
          label={report.embeddings_enabled ? "Semantic ready" : "Lexical only"}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <TotalPill label="Chapters" value={formatCompact(report.totals.chapters)} />
        <TotalPill label="Pages" value={formatCompact(report.totals.pages)} />
        <TotalPill label="Topics" value={formatCompact(report.totals.concepts)} />
        <TotalPill label="Chunks" value={formatCompact(report.totals.chunks)} />
        <TotalPill label="Embedded" value={formatCompact(report.totals.embedded_chunks)} />
        <TotalPill label="Jobs" value={formatCompact(report.jobs_total)} />
      </div>

      {(subjects.length || classes.length) ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {subjects.map(([subject, count]) => (
            <span key={subject} className="rounded-full border border-[#14B8A6]/25 bg-[#14B8A6]/10 px-3 py-1 text-xs font-semibold text-[#0F8F82]">
              {subject} · {count}
            </span>
          ))}
          {classes.map(([cls, count]) => (
            <span key={cls} className="rounded-full border border-[color:var(--agentify-border)] px-3 py-1 text-xs font-semibold text-[color:var(--agentify-muted-text)]">
              Class {cls} · {count}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 space-y-2">
        {report.chapters.map((chapter) => (
          <ChapterRow key={chapter.id} chapter={chapter} />
        ))}
      </div>
    </div>
  );
}
