"use client";

import { AppIcon, type AppIconName } from "@/components/ui/Polished";
import { useCatalog } from "@/lib/catalog";
import {
  EXAM_ROUTES,
  examHref,
  getExamScopeLabels,
  readExamScope,
} from "@/features/exam/routes";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "./hub.module.css";

type ExamDestination = {
  number: string;
  title: string;
  label: string;
  description: string;
  flow: string;
  route: string;
  icon: AppIconName;
  tone: "teal" | "violet" | "gold" | "blue";
};

const DESTINATIONS: ExamDestination[] = [
  {
    number: "01",
    title: "MCQ Test",
    label: "Objective practice",
    description: "Build a grounded question set, answer one question at a time, and review every explanation.",
    flow: "Configure  /  Attempt  /  Results",
    route: EXAM_ROUTES.mcq,
    icon: "mission",
    tone: "teal",
  },
  {
    number: "02",
    title: "Probable Questions",
    label: "Focused prediction",
    description: "Prepare likely questions from your syllabus or analyzed paper patterns in a dedicated view.",
    flow: "Choose source  /  Generate  /  Study",
    route: EXAM_ROUTES.probable,
    icon: "spark",
    tone: "violet",
  },
  {
    number: "03",
    title: "Question Paper Lab",
    label: "Paper intelligence",
    description: "Upload previous papers, inspect extracted questions, and uncover repeatable exam patterns.",
    flow: "Upload  /  Extract  /  Analyze",
    route: EXAM_ROUTES.papers,
    icon: "book",
    tone: "gold",
  },
  {
    number: "04",
    title: "Answer Workspace",
    label: "Written practice",
    description: "Write a complete answer in a quiet workspace, then receive mark-aware feedback and next steps.",
    flow: "Set up  /  Write  /  Improve",
    route: EXAM_ROUTES.workspace,
    icon: "study",
    tone: "blue",
  },
];

export default function ExamModePage() {
  const searchParams = useSearchParams();
  const { chapters } = useCatalog();
  const scope = readExamScope(searchParams);
  const labels = getExamScopeLabels(chapters, scope);

  return (
    <main className={styles.hub}>
      <div className={styles.ambient} aria-hidden="true">
        <span />
        <span />
      </div>

      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>AgentifyAI / Exam Lab</p>
            <h1>One clear workspace for every exam task.</h1>
            <p className={styles.intro}>
              Choose what you want to accomplish now. Each tool opens on its own full-screen canvas, so your attention stays on one job at a time.
            </p>
          </div>

          <div className={styles.scope} aria-label="Current exam focus">
            <span>Current focus</span>
            <strong>{labels.chapter}</strong>
            <small>{labels.topic}</small>
          </div>
        </header>

        <section className={styles.grid} aria-label="Exam Lab workspaces">
          {DESTINATIONS.map((destination) => (
            <Link
              key={destination.route}
              href={examHref(destination.route, scope)}
              className={styles.card}
              data-tone={destination.tone}
            >
              <span className={styles.cardGlow} aria-hidden="true" />
              <div className={styles.cardTopline}>
                <span className={styles.number}>{destination.number}</span>
                <span className={styles.icon} aria-hidden="true">
                  <AppIcon name={destination.icon} />
                </span>
              </div>

              <div className={styles.cardCopy}>
                <p>{destination.label}</p>
                <h2>{destination.title}</h2>
                <span>{destination.description}</span>
              </div>

              <div className={styles.cardFooter}>
                <small>{destination.flow}</small>
                <span className={styles.openAction}>
                  Open
                  <AppIcon name="arrowRight" />
                </span>
              </div>
            </Link>
          ))}
        </section>

        <p className={styles.footerNote}>
          Your selected chapter and topic move with you across every Exam Lab workspace.
        </p>
      </div>
    </main>
  );
}
