"use client";

import { AppIcon } from "@/components/ui/Polished";
import Link from "next/link";
import { getMissionQuestion } from "./contracts";
import { usePlanningExperience } from "./PlanningExperience";
import { PlanningLoading, PlanningScreen, planningStyles as styles } from "./PlanningScreen";
import { getPlanningHandoffs, PLANNING_ROUTES } from "./routes";

export default function PlanningReview() {
  const { authBusy, hydrated, activePlan } = usePlanningExperience();
  if (authBusy || !hydrated) return <PlanningLoading label="Preparing your plan review..." />;

  const checkpoint = activePlan?.checkpoint;
  if (!activePlan || !checkpoint) {
    return (
      <PlanningScreen
        eyebrow="Planning Lab / Review"
        title="Complete a checkpoint first."
        intro="Review is based on a response confirmed by the learning service. No saved signal means no invented performance report."
        backHref={activePlan ? PLANNING_ROUTES.active : PLANNING_ROUTES.home}
      >
        <div className={styles.reviewWrap}>
          <section className={styles.emptyCard}>
            <h2>{activePlan ? "Your active plan is ready." : "No active plan found."}</h2>
            <p>{activePlan ? "Use its diagnostic checkpoint to create a real review signal." : "Build or restore a plan before opening review."}</p>
            <div className={styles.emptyActions}>
              <Link href={activePlan ? PLANNING_ROUTES.checkpoint : PLANNING_ROUTES.new} className={styles.primaryButton}>
                {activePlan ? "Open checkpoint" : "Build a plan"}
              </Link>
              <Link href={PLANNING_ROUTES.history} className={styles.secondaryButton}>Device history</Link>
            </div>
          </section>
        </div>
      </PlanningScreen>
    );
  }

  const question = getMissionQuestion(activePlan.mission);
  const handoffs = getPlanningHandoffs(activePlan.scope, activePlan.mission.mission_id);

  return (
    <PlanningScreen
      eyebrow="Planning Lab / Performance review"
      title="Use the signal. Choose the next move."
      intro="Your checkpoint was accepted by the learning service. The plan snapshot itself remains device-local until plan synchronization is available."
      backHref={PLANNING_ROUTES.active}
      backLabel="Active plan"
      actions={(
        <>
          <Link href={PLANNING_ROUTES.history} className={styles.secondaryButton}>Device history</Link>
          <Link href={PLANNING_ROUTES.new} className={styles.primaryButton}>Build another plan</Link>
        </>
      )}
    >
      <div className={styles.reviewWrap}>
        <section className={styles.reviewCard}>
          <div className={styles.reviewHero}>
            <span className={styles.reviewIcon} aria-hidden="true"><AppIcon name={checkpoint.correct ? "check" : "spark"} /></span>
            <div>
              <p className={styles.eyebrow}>{checkpoint.correct ? "Strong first signal" : "Targeted repair needed"}</p>
              <h2>{checkpoint.report.title}</h2>
              <p>{checkpoint.report.summary}</p>
            </div>
          </div>

          <div className={styles.summaryMetrics}>
            <div><span>Topic</span><strong>{activePlan.scope.topicLabel}</strong></div>
            <div><span>Answer</span><strong>{checkpoint.correct ? "Correct" : "Needs review"}</strong></div>
            <div><span>Confidence</span><strong>{checkpoint.confidence}</strong></div>
            <div><span>Focus signal</span><strong>{checkpoint.focusScore}/100</strong></div>
          </div>

          <ul className={styles.nextList} aria-label="Recommended next actions">
            {checkpoint.report.next.map((item, index) => (
              <li key={item}><span>{index + 1}</span>{item}</li>
            ))}
          </ul>

          {question?.explanation ? (
            <div className={styles.explanation}>
              <strong>Checkpoint explanation</strong>
              <p>{question.explanation}</p>
            </div>
          ) : null}
        </section>
      </div>

      <section className={styles.handoffSection} aria-labelledby="review-next-heading">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Next workspace</p>
            <h2 id="review-next-heading">Continue with evidence, not guesswork</h2>
            <p>Keep the same chapter and topic as you move from this review.</p>
          </div>
        </div>
        <div className={styles.handoffGrid}>
          {handoffs.map((handoff) => (
            <Link key={handoff.mode} href={handoff.href} className={styles.handoffCard}>
              <span className={styles.modeChip}>{handoff.mode}</span>
              <strong>{handoff.title}</strong>
              <p>{handoff.detail}</p>
              <span>Open workspace →</span>
            </Link>
          ))}
        </div>
      </section>
    </PlanningScreen>
  );
}

