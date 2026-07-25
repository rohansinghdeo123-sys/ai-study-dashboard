import { AppIcon } from "@/components/ui/Polished";
import { LEARNING_WORKSPACE_STEPS } from "@/features/learning-workspace/config";
import type { LearningModeId } from "@/features/learning-workspace/types";
import Link from "next/link";

export default function LearningJourney({
  recommendedMode,
}: {
  recommendedMode: LearningModeId;
}) {
  return (
    <section className="learning-journey" aria-labelledby="learning-journey-title">
      <div className="learning-journey-heading">
        <div>
          <p>Learning flow</p>
          <h2 id="learning-journey-title">One connected path. Four focused modes.</h2>
        </div>
        <span>Move forward when you are ready</span>
      </div>

      <ol className="learning-journey-grid">
        {LEARNING_WORKSPACE_STEPS.map((step) => {
          const recommended = step.id === recommendedMode;

          return (
            <li
              key={step.id}
              className="learning-journey-item"
              data-mode={step.id}
              data-recommended={recommended ? "true" : "false"}
            >
              <Link href={step.href} className="learning-journey-card">
                <span className="learning-journey-step">
                  <span>{step.step}</span>
                  <span className="learning-journey-icon" aria-hidden="true">
                    <AppIcon name={step.icon} />
                  </span>
                </span>

                <span className="learning-journey-card-copy">
                  <span className="learning-journey-card-topline">
                    <small>{step.eyebrow}</small>
                    {recommended ? <em>Recommended</em> : null}
                  </span>
                  <strong>{step.title}</strong>
                  <span>{step.description}</span>
                </span>

                <span className="learning-journey-outcome">
                  <small>Outcome</small>
                  <span>{step.outcome}</span>
                  <AppIcon name="arrowRight" />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
