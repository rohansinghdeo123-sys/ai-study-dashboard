"use client";

import { StudyScreen, StudySyncPill } from "@/components/study/StudyScreen";
import { AppIcon } from "@/components/ui/Polished";
import { useAuth } from "@/context/AuthContext";
import { createConversationId } from "@/features/study/conversationUtils";
import { useStudyConversations } from "@/features/study/hooks/useStudyConversations";
import {
  legacyStudyHandoff,
  openStudyScope,
  studySessionHref,
  syllabusStudyScope,
} from "@/features/study/routes";
import type { StudyConversation } from "@/features/study/types";
import { useCatalog } from "@/lib/catalog";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./home.module.css";

function conversationHref(conversation: StudyConversation) {
  return studySessionHref(conversation.id, conversation.scope || openStudyScope());
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function StudyHomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { chapters, source, settled } = useCatalog();
  const { conversations, syncState } = useStudyConversations();
  const legacyHandoff = legacyStudyHandoff(searchParams);
  const requestedChapter = searchParams.get("chapter") || "";
  const requestedTopic = searchParams.get("topic") || "";
  const [chapterId, setChapterId] = useState(requestedChapter);
  const [topicId, setTopicId] = useState(requestedTopic);

  useEffect(() => {
    if (legacyHandoff) router.replace(legacyHandoff);
  }, [legacyHandoff, router]);

  const selectedChapter = chapters.find((chapter) => chapter.value === chapterId)
    || (settled ? chapters.find((chapter) => chapter.value === requestedChapter) || chapters[0] : undefined);
  const selectedTopic = selectedChapter?.topics.find((topic) => topic.value === topicId)
    || (settled
      ? selectedChapter?.topics.find((topic) => topic.value === requestedTopic) || selectedChapter?.topics[0]
      : undefined);
  const recent = useMemo(
    () => conversations.filter((conversation) => !conversation.archived).slice(0, 3),
    [conversations],
  );
  const firstName = profile?.name?.split(" ")[0] || "Student";

  const startSession = (kind: "open" | "syllabus") => {
    const scope = kind === "syllabus" && selectedChapter && selectedTopic
      ? syllabusStudyScope(selectedChapter, selectedTopic, source === "published" ? "published" : "starter")
      : openStudyScope();
    router.push(studySessionHref(createConversationId(), scope, { fresh: true }));
  };

  if (legacyHandoff) {
    return <div className={styles.redirectState} role="status">Opening the focused learning workspace…</div>;
  }

  return (
    <StudyScreen
      eyebrow="AgentifyAI / Study Lab"
      title={`What should we understand today, ${firstName}?`}
      description="Start with an open question or anchor your tutor to one published chapter. Every conversation opens in a quiet, focused learning room."
      aside={<StudySyncPill state={syncState} />}
    >
      <div className={styles.workspace}>
        <section className={styles.startPanel} aria-labelledby="start-study-heading">
          <div className={styles.panelHeading}>
            <div>
              <p>Choose your learning route</p>
              <h2 id="start-study-heading">Start a focused session</h2>
            </div>
            <span className={styles.sourceBadge} data-source={source}>
              {source === "published" ? "Published syllabus" : settled ? "Starter syllabus" : "Checking syllabus"}
            </span>
          </div>

          <button type="button" className={styles.openTutor} onClick={() => startSession("open")}>
            <span className={styles.routeIcon}><AppIcon name="spark" /></span>
            <span className={styles.routeCopy}>
              <small>Open tutor</small>
              <strong>Ask anything you want to understand</strong>
              <span>Best for doubts, examples, step-by-step help, and continuing a natural learning conversation.</span>
            </span>
            <span className={styles.routeAction}>Start <AppIcon name="arrowRight" /></span>
          </button>

          <div className={styles.syllabusRoute}>
            <div className={styles.syllabusCopy}>
              <span className={styles.routeIcon}><AppIcon name="book" /></span>
              <div>
                <small>Syllabus-grounded tutor</small>
                <strong>Learn from one selected topic</strong>
                <p>The tutor will use this topic as the visible learning source and tell you when material is unavailable.</p>
              </div>
            </div>

            <div className={styles.scopeControls}>
              <label>
                <span>Chapter</span>
                <select
                  value={selectedChapter?.value || ""}
                  disabled={!settled || !selectedChapter}
                  onChange={(event) => {
                    const next = chapters.find((chapter) => chapter.value === event.target.value);
                    setChapterId(event.target.value);
                    setTopicId(next?.topics[0]?.value || "");
                  }}
                >
                  {chapters.map((chapter) => <option key={chapter.value} value={chapter.value}>{chapter.label}</option>)}
                </select>
              </label>
              <label>
                <span>Topic</span>
                <select
                  value={selectedTopic?.value || ""}
                  disabled={!settled || !selectedTopic}
                  onChange={(event) => setTopicId(event.target.value)}
                >
                  {(selectedChapter?.topics || []).map((topic) => <option key={topic.value} value={topic.value}>{topic.label}</option>)}
                </select>
              </label>
              <button
                type="button"
                disabled={!settled || !selectedChapter || !selectedTopic}
                onClick={() => startSession("syllabus")}
              >
                Learn this topic <AppIcon name="arrowRight" />
              </button>
            </div>
          </div>
        </section>

        <aside className={styles.continuePanel} aria-labelledby="continue-study-heading">
          <div className={styles.panelHeading}>
            <div>
              <p>Pick up naturally</p>
              <h2 id="continue-study-heading">Recent conversations</h2>
            </div>
            <Link href="/dashboard/study/history">View all</Link>
          </div>

          {recent.length ? (
            <div className={styles.recentList}>
              {recent.map((conversation) => (
                <Link key={conversation.id} href={conversationHref(conversation)} className={styles.recentRow}>
                  <span className={styles.recentIcon}><AppIcon name={conversation.pinned ? "spark" : "history"} /></span>
                  <span>
                    <strong>{conversation.title}</strong>
                    <small>{conversation.scope?.source === "syllabus" ? conversation.scope.topicLabel : conversation.topic || "Open tutor"}</small>
                  </span>
                  <time dateTime={conversation.updatedAt}>{relativeTime(conversation.updatedAt)}</time>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.emptyRecent}>
              <AppIcon name="study" />
              <strong>Your first conversation starts here</strong>
              <span>Ask a question above. Study Lab will keep the thread ready for you to continue.</span>
            </div>
          )}

          <div className={styles.promise}>
            <span><AppIcon name="check" /></span>
            <div>
              <strong>One task at a time</strong>
              <p>Revision tools and exam practice stay in their own dedicated labs, so this space remains focused on learning.</p>
            </div>
          </div>
        </aside>
      </div>
    </StudyScreen>
  );
}
