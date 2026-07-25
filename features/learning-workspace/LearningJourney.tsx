import { AppIcon } from "@/components/ui/Polished";
import { LEARNING_WORKSPACE_STEPS } from "@/features/learning-workspace/config";
import Link from "next/link";
import type { CSSProperties } from "react";
import styles from "./journey-landing.module.css";

const STEP_LABELS = ["Begin", "Build", "Strengthen", "Destination"] as const;

export default function LearningJourney() {
  return (
    <section
      className={styles.canvas}
      aria-labelledby="learning-journey-title"
    >
      <h1 id="learning-journey-title" className={styles.srOnly}>
        AgentifyAI learning journey
      </h1>

      <span className={styles.connector} aria-hidden="true" />

      <ol className={styles.grid} aria-label="Planning, Study, Revision, and Exam">
        {LEARNING_WORKSPACE_STEPS.map((step, index) => (
          <li
            key={step.id}
            className={styles.tile}
            data-mode={step.id}
            style={{ "--journey-delay": `${index * 90}ms` } as CSSProperties}
          >
            <Link
              href={step.href}
              className={styles.card}
              aria-describedby={`${step.id}-description ${step.id}-outcome`}
            >
              <span className={styles.cardAura} aria-hidden="true" />

              <span className={styles.cardTopline}>
                <span className={styles.sequence}>
                  <strong>{String(step.step).padStart(2, "0")}</strong>
                  <small>{STEP_LABELS[index]}</small>
                </span>
                <span className={styles.icon} aria-hidden="true">
                  <AppIcon name={step.icon} />
                </span>
              </span>

              <span className={styles.cardCopy}>
                <small>{step.eyebrow}</small>
                <h2>{step.title}</h2>
                <span id={`${step.id}-description`}>{step.description}</span>
              </span>

              <span className={styles.cardFooter}>
                <span id={`${step.id}-outcome`}>
                  <small>Outcome</small>
                  <strong>{step.outcome}</strong>
                </span>
                <span className={styles.openIndicator} aria-hidden="true">
                  <AppIcon name="arrowRight" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
