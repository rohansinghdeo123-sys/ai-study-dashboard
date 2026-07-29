import type { WrittenFeedback } from "@/features/exam/written";
import styles from "./writtenFeedback.module.css";

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMarks(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function scorePercent(value: number) {
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, normalized));
}

function PointList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className={styles.empty}>{empty}</p>;
  return (
    <ul className={styles.points}>
      {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
    </ul>
  );
}

export function WrittenFeedbackView({ feedback }: { feedback: WrittenFeedback }) {
  return (
    <div className={styles.feedback}>
      <aside className={styles.scoreCard} aria-label="Teacher score">
        <p>Teacher score</p>
        <strong>{formatMarks(feedback.marks_awarded)}<span>/{formatMarks(feedback.marks_total)}</span></strong>
        <div className={styles.scoreTrack} aria-hidden="true">
          <i style={{ width: `${scorePercent(feedback.score_percentage)}%` }} />
        </div>
        <span>{Math.round(scorePercent(feedback.score_percentage))}%</span>
      </aside>

      <div className={styles.report}>
        <section className={styles.summary}>
          <p className={styles.eyebrow}>Teacher feedback</p>
          <h2>{feedback.teacher_feedback || "Your answer has been evaluated."}</h2>
          {feedback.improve_to_full_marks ? <p>{feedback.improve_to_full_marks}</p> : null}
        </section>

        <div className={styles.pointGrid}>
          <section className={styles.covered}>
            <h3>What you covered</h3>
            <PointList items={feedback.covered_points || []} empty="No covered points were returned." />
          </section>
          <section className={styles.missing}>
            <h3>What to improve</h3>
            <PointList items={[...(feedback.missing_points || []), ...(feedback.incorrect_points || [])]} empty="No missing points were returned." />
          </section>
        </div>

        {Object.keys(feedback.rubric_scores || {}).length ? (
          <section className={styles.rubric}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Rubric</p>
              <h3>How the answer was judged</h3>
            </div>
            <div className={styles.rubricList}>
              {Object.entries(feedback.rubric_scores).map(([key, value]) => {
                const percent = scorePercent(value);
                return (
                  <div key={key}>
                    <span>{formatLabel(key)}</span>
                    <strong>{Math.round(percent)}%</strong>
                    <i><b style={{ width: `${percent}%` }} /></i>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {feedback.presentation_feedback ? (
          <section className={styles.note}>
            <p className={styles.eyebrow}>Presentation</p>
            <p>{feedback.presentation_feedback}</p>
          </section>
        ) : null}

        <section className={styles.modelAnswer}>
          <p className={styles.eyebrow}>Model answer</p>
          <h3>A stronger response</h3>
          <p>{feedback.model_answer || "A model answer was not returned for this attempt."}</p>
        </section>

        {feedback.next_question_suggestion ? (
          <section className={styles.nextStep}>
            <p className={styles.eyebrow}>Next practice</p>
            <p>{feedback.next_question_suggestion}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
