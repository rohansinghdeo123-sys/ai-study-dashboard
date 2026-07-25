import { AppIcon } from "@/components/ui/Polished";
import { getSessionDestination } from "@/features/learning-workspace/config";
import type { SessionRecord } from "@/features/learning-workspace/types";
import Link from "next/link";

function sessionAccuracy(session: SessionRecord) {
  if (!session.total_questions) return 0;
  return Math.round((session.score / session.total_questions) * 100);
}

function formatSessionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function RecentWork({
  session,
  loading,
  failed,
}: {
  session: SessionRecord | null;
  loading: boolean;
  failed: boolean;
}) {
  return (
    <section className="learning-recent" aria-labelledby="learning-recent-title">
      <div className="learning-recent-heading">
        <div>
          <p>Pick up quickly</p>
          <h2 id="learning-recent-title">Recent work</h2>
        </div>
        <Link href="/dashboard/analytics">View analytics</Link>
      </div>

      {loading ? (
        <div className="learning-recent-loading" role="status" aria-live="polite">
          <span />
          <span />
          <span className="sr-only">Loading recent work</span>
        </div>
      ) : session ? (
        <Link href={getSessionDestination(session)} className="learning-recent-row">
          <span className="learning-recent-icon" aria-hidden="true">
            <AppIcon name="history" />
          </span>
          <span className="learning-recent-copy">
            <strong>{session.topic || session.subject || "Learning session"}</strong>
            <span>
              {session.subject || "Study"} · {formatSessionDate(session.completed_at)}
            </span>
          </span>
          <span className="learning-recent-stat">
            <strong>{sessionAccuracy(session)}%</strong>
            <small>accuracy</small>
          </span>
          <span className="learning-recent-stat">
            <strong>+{session.xp_earned}</strong>
            <small>XP</small>
          </span>
          <span className="learning-recent-open">
            Open
            <AppIcon name="arrowRight" />
          </span>
        </Link>
      ) : (
        <div className="learning-recent-empty">
          <span className="learning-recent-icon" aria-hidden="true">
            <AppIcon name="spark" />
          </span>
          <span>
            <strong>{failed ? "Recent work is temporarily unavailable" : "Your first session starts here"}</strong>
            <small>
              {failed
                ? "Your learning modes are ready while we reconnect your history."
                : "Complete a plan or study session and it will appear here for a fast return."}
            </small>
          </span>
        </div>
      )}
    </section>
  );
}
