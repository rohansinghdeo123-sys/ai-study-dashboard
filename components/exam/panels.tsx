"use client";

/** Presentational Exam Mode panels extracted from the exam page monolith. */

import { AppIcon, type AppIconName } from "@/components/ui/Polished";
import { EMPTY_VALUE } from "@/lib/examConfig";
import { displayValue, formatLabel, getRecordEntries, toNumber } from "@/lib/format";

export function DistributionList({
  title,
  data,
  suffix = "",
}: {
  title: string;
  data: Record<string, string | number> | Record<string, number> | undefined;
  suffix?: string;
}) {
  const entries = getRecordEntries(data);
  const max = Math.max(1, ...entries.map((entry) => toNumber(entry.value)));

  return (
    <section className="exam-distribution-card">
      <div className="exam-mini-header">
        <p className="dashboard-section-kicker">{title}</p>
      </div>
      {entries.length ? (
        <div className="exam-distribution-list">
          {entries.slice(0, 7).map((entry) => {
            const numeric = toNumber(entry.value);
            return (
              <div key={entry.key}>
                <span>{formatLabel(entry.key)}</span>
                <strong>{displayValue(entry.value)}{suffix}</strong>
                <i style={{ width: `${Math.max(8, Math.round((numeric / max) * 100))}%` }} />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="exam-muted-copy">No signal yet.</p>
      )}
    </section>
  );
}

export function ChipList({ items, empty = "No signal yet." }: { items: string[]; empty?: string }) {
  return items.length ? (
    <div className="exam-chip-list">
      {items.slice(0, 10).map((item) => <span key={item}>{formatLabel(item)}</span>)}
    </div>
  ) : (
    <p className="exam-muted-copy">{empty}</p>
  );
}

export function ExamReadinessStrip({
  hasPack,
  answeredCount,
  totalQuestions,
  submitted,
  probableCount,
  papersCount,
  patternReady,
  writtenScore,
}: {
  hasPack: boolean;
  answeredCount: number;
  totalQuestions: number;
  submitted: boolean;
  probableCount: number;
  papersCount: number;
  patternReady: boolean;
  writtenScore: string;
}) {
  const items: Array<{
    label: string;
    value: string;
    detail: string;
    icon: AppIconName;
    active: boolean;
    complete: boolean;
  }> = [
    {
      label: "MCQ",
      value: hasPack ? "Ready" : "Pending",
      detail: hasPack ? `${totalQuestions} questions generated` : "Generate from selected material",
      icon: "book",
      active: hasPack,
      complete: hasPack,
    },
    {
      label: "Papers",
      value: `${papersCount}`,
      detail: papersCount ? "Uploaded for pattern work" : "Upload paper PDFs or text",
      icon: "download",
      active: papersCount > 0,
      complete: papersCount > 0,
    },
    {
      label: "Pattern",
      value: patternReady ? "Ready" : "Open",
      detail: patternReady ? "Analysis available" : "Analyze uploaded papers",
      icon: "analytics",
      active: patternReady,
      complete: patternReady,
    },
    {
      label: "Attempt",
      value: totalQuestions ? `${answeredCount}/${totalQuestions}` : "0/5",
      detail: submitted ? "Submitted once" : "Answer all MCQs before review",
      icon: "check",
      active: hasPack && !submitted,
      complete: Boolean(totalQuestions && answeredCount === totalQuestions),
    },
    {
      label: "Written",
      value: writtenScore,
      detail: probableCount ? `${probableCount} prompts ready` : "Teacher feedback after submit",
      icon: "study",
      active: writtenScore !== EMPTY_VALUE,
      complete: writtenScore !== EMPTY_VALUE,
    },
  ];

  return (
    <section className="exam-readiness-strip" aria-label="Exam readiness">
      {items.map((item) => (
        <article
          key={item.label}
          className="exam-readiness-card"
          data-active={item.active ? "true" : "false"}
          data-complete={item.complete ? "true" : "false"}
        >
          <span className="exam-readiness-icon" aria-hidden="true">
            <AppIcon name={item.complete ? "check" : item.icon} />
          </span>
          <div>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </div>
        </article>
      ))}
    </section>
  );
}
