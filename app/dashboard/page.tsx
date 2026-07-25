"use client";

import { AppIcon, LoadingState } from "@/components/ui/Polished";
import { useAuth } from "@/context/AuthContext";
import {
  LEARNING_WORKSPACE_STEPS,
  LearningJourney,
  RecentWork,
  getContinueDestination,
  getRecommendedMode,
  type ProgressSummary,
  type SessionRecord,
} from "@/features/learning-workspace";
import { apiJson, invalidateApiCache, primeBackend } from "@/lib/apiClient";
import { getPublicBackendUrl } from "@/lib/env";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const EMPTY_PROGRESS: ProgressSummary = {
  total_tests: 0,
  total_questions: 0,
  total_correct: 0,
  xp: 0,
  streak: 0,
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeProgress(value: unknown): ProgressSummary {
  const source = isRecord(value) ? value : {};
  const summary = isRecord(source.summary) ? source.summary : source;

  return {
    total_tests: Math.max(0, toNumber(summary.total_tests ?? summary.totalTests ?? summary.sessions)),
    total_questions: Math.max(
      0,
      toNumber(summary.total_questions ?? summary.totalQuestions ?? summary.total_mcqs_attempted),
    ),
    total_correct: Math.max(0, toNumber(summary.total_correct ?? summary.totalCorrect)),
    xp: Math.max(0, toNumber(summary.xp ?? summary.total_xp)),
    streak: Math.max(0, toNumber(summary.streak)),
  };
}

function normalizeSessions(value: unknown): SessionRecord[] {
  const list = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.sessions)
      ? value.sessions
      : [];

  return list
    .map((item, index): SessionRecord | null => {
      if (!isRecord(item)) return null;

      return {
        id: String(item.id ?? item.session_id ?? `${item.topic || "session"}-${index}`),
        subject: String(item.subject || "Study"),
        class_level: item.class_level ? String(item.class_level) : undefined,
        topic: String(item.topic || "Learning session"),
        total_questions: Math.max(0, toNumber(item.total_questions ?? item.questions)),
        score: Math.max(0, toNumber(item.score ?? item.correct)),
        xp_earned: Math.max(0, toNumber(item.xp_earned ?? item.xp)),
        time_spent_seconds: Math.max(
          0,
          toNumber(item.time_spent_seconds ?? item.duration_seconds),
        ),
        session_type: String(item.session_type || item.type || "study"),
        completed_at: String(
          item.completed_at
          ?? item.completedAt
          ?? item.timestamp
          ?? item.date
          ?? item.createdAt
          ?? "",
        ),
      };
    })
    .filter((session): session is SessionRecord => session !== null)
    .sort((left, right) => {
      const leftTime = new Date(left.completed_at).getTime();
      const rightTime = new Date(right.completed_at).getTime();
      return (Number.isFinite(rightTime) ? rightTime : 0)
        - (Number.isFinite(leftTime) ? leftTime : 0);
    });
}

function getAccuracy(progress: ProgressSummary) {
  if (!progress.total_questions) return 0;
  return Math.round((progress.total_correct / progress.total_questions) * 100);
}

function getRecommendationDetail(session: SessionRecord | null) {
  if (!session) return "Start by turning your goal into a focused learning plan.";

  const sessionType = session.session_type.toLowerCase();
  if (sessionType.includes("mission") || sessionType.includes("plan")) {
    return "Your plan is ready. Bring the next task into Study Lab.";
  }
  if (sessionType.includes("exam") || sessionType.includes("test")) {
    return "Your exam closes this learning cycle. Start a fresh plan for what comes next.";
  }
  if (sessionType.includes("revision") || sessionType.includes("review")) {
    return "You have strengthened recall. Check your readiness in Exam mode.";
  }
  if (
    sessionType.includes("study")
    || sessionType.includes("coach")
    || sessionType.includes("tutor")
  ) {
    return `Strengthen recall from ${session.topic || "your last topic"} in Revision mode.`;
  }
  return "Start a focused plan for your next learning goal.";
}

export default function DashboardPage() {
  const { profile, userId, loading, getAuthHeaders } = useAuth();
  const backendURL = getPublicBackendUrl();
  const [progress, setProgress] = useState<ProgressSummary>(EMPTY_PROGRESS);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const [sessionsFailed, setSessionsFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (loading || !userId) return;

    let active = true;

    async function loadWorkspace() {
      setLoadingData(true);
      setDataError("");
      setSessionsFailed(false);
      primeBackend(backendURL);

      try {
        const headers = await getAuthHeaders();
        const forceFresh = reloadToken > 0;
        const [progressResult, sessionsResult] = await Promise.allSettled([
          apiJson<unknown>(`${backendURL}/get-progress/${userId}`, {
            headers,
            cacheKey: `progress:${userId}`,
            cacheTtlMs: 30000,
            forceFresh,
            retries: 1,
            timeoutMs: 7000,
          }),
          apiJson<unknown>(`${backendURL}/sessions/${userId}`, {
            headers,
            cacheKey: `sessions:${userId}`,
            cacheTtlMs: 30000,
            forceFresh,
            retries: 1,
            timeoutMs: 7000,
          }),
        ]);

        if (!active) return;

        if (progressResult.status === "fulfilled") {
          setProgress(normalizeProgress(progressResult.value));
        }
        if (sessionsResult.status === "fulfilled") {
          setSessions(normalizeSessions(sessionsResult.value));
        } else {
          setSessionsFailed(true);
        }
        if (progressResult.status === "rejected" || sessionsResult.status === "rejected") {
          setDataError("Some progress details could not refresh. Your learning modes are still ready.");
        }
      } catch {
        if (!active) return;
        setSessionsFailed(true);
        setDataError("Progress could not refresh. Your learning modes are still ready.");
      } finally {
        if (active) setLoadingData(false);
      }
    }

    void loadWorkspace();
    return () => {
      active = false;
    };
  }, [backendURL, getAuthHeaders, loading, reloadToken, userId]);

  const latestSession = sessions[0] || null;
  const recommendedMode = useMemo(
    () => getRecommendedMode(latestSession),
    [latestSession],
  );
  const recommendedStep = LEARNING_WORKSPACE_STEPS.find(
    (step) => step.id === recommendedMode,
  ) ?? LEARNING_WORKSPACE_STEPS[0];
  const continueDestination = getContinueDestination(latestSession, recommendedMode);
  const accuracy = getAccuracy(progress);
  const displayName = profile?.name || "Student";
  const firstName = displayName.trim().split(/\s+/)[0] || "Student";
  const classLevel = profile?.classLevel || "";

  const retryWorkspace = () => {
    invalidateApiCache(`progress:${userId}`);
    invalidateApiCache(`sessions:${userId}`);
    setReloadToken((current) => current + 1);
  };

  if (loading) {
    return (
      <LoadingState
        title="Preparing your workspace..."
        detail="Connecting your plan, study, revision, and exam modes."
      />
    );
  }

  return (
    <div className="learning-workspace-page" aria-busy={loadingData}>
      <header className="learning-workspace-hero">
        <div className="learning-workspace-hero-copy">
          <p className="learning-workspace-eyebrow">
            Your workspace{classLevel ? <span>{classLevel}</span> : null}
          </p>
          <h1>
            Your next clear step,
            <span>{firstName}.</span>
          </h1>
          <p className="learning-workspace-intro">
            Plan the route, learn it in Study Lab, strengthen it through Revision,
            then prove readiness in Exam mode.
          </p>

          <Link href={continueDestination} className="learning-workspace-continue">
            <span>
              <small>Recommended next</small>
              <strong>
                {latestSession ? `Continue in ${recommendedStep.title}` : "Start Planning"}
              </strong>
            </span>
            <AppIcon name="arrowRight" />
          </Link>

          <p className="learning-workspace-reason">
            <AppIcon name="spark" />
            {getRecommendationDetail(latestSession)}
          </p>
        </div>

        <aside className="learning-workspace-snapshot" aria-label="Progress snapshot">
          <div className="learning-workspace-snapshot-heading">
            <span>Progress snapshot</span>
            {loadingData ? <small>Refreshing</small> : <small>Up to date</small>}
          </div>
          <dl>
            <div>
              <dt>Total XP</dt>
              <dd>{progress.xp.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Day streak</dt>
              <dd>{progress.streak}</dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd>{progress.total_questions ? `${accuracy}%` : "--"}</dd>
            </div>
            <div>
              <dt>Sessions</dt>
              <dd>{progress.total_tests}</dd>
            </div>
          </dl>
          <div className="learning-workspace-snapshot-note">
            <AppIcon name="analytics" />
            <span>
              {progress.total_questions
                ? `${progress.total_correct} of ${progress.total_questions} answers correct`
                : "Your progress will build with each completed session"}
            </span>
          </div>
        </aside>
      </header>

      {dataError ? (
        <div className="learning-workspace-notice" role="status">
          <span>{dataError}</span>
          <button type="button" onClick={retryWorkspace} disabled={loadingData}>
            {loadingData ? "Retrying..." : "Retry"}
          </button>
        </div>
      ) : null}

      <LearningJourney recommendedMode={recommendedMode} />
      <RecentWork session={latestSession} loading={loadingData} failed={sessionsFailed} />
    </div>
  );
}
