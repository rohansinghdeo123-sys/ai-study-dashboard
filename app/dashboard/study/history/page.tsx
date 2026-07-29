"use client";

import { StudyScreen, StudySyncPill } from "@/components/study/StudyScreen";
import { AppIcon } from "@/components/ui/Polished";
import { useAuth } from "@/context/AuthContext";
import {
  RenameConversationDialog,
  StudyConfirmDialog,
} from "@/features/study/components/StudyConversationDialogs";
import {
  removeStudyConversation,
  studyErrorMessage,
  updateStudyConversation,
} from "@/features/study/api";
import { useStudyConversations } from "@/features/study/hooks/useStudyConversations";
import { openStudyScope, studySessionHref } from "@/features/study/routes";
import type { StudyConversation } from "@/features/study/types";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./history.module.css";

function conversationHref(conversation: StudyConversation) {
  return studySessionHref(conversation.id, conversation.scope || openStudyScope());
}

function readableDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Recently";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StudyHistoryPage() {
  const { userId, getAuthHeaders } = useAuth();
  const { conversations, setConversations, syncState, reload } = useStudyConversations();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [renameTarget, setRenameTarget] = useState<StudyConversation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyConversation | null>(null);
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (Boolean(conversation.archived) !== showArchived) return false;
      const searchable = [
        conversation.title,
        conversation.chapter,
        conversation.topic,
        conversation.scope?.chapterLabel,
        conversation.scope?.topicLabel,
      ].filter(Boolean).join(" ").toLowerCase();
      return !query || searchable.includes(query);
    });
  }, [conversations, search, showArchived]);

  const syncPatch = async (
    conversation: StudyConversation,
    patch: Partial<Pick<StudyConversation, "title" | "pinned" | "archived" | "titleLocked">>,
  ) => {
    setConversations((items) => items.map((item) => item.id === conversation.id ? { ...item, ...patch } : item));
    if (!userId) return;
    try {
      await updateStudyConversation(
        {
          backendURL: process.env.NEXT_PUBLIC_BACKEND_URL,
          headers: await getAuthHeaders(),
        },
        userId,
        conversation,
        patch,
      );
      setNotice("");
    } catch (error) {
      setNotice(`${studyErrorMessage(error)} The device copy has been kept.`);
    }
  };

  const confirmRename = (title: string) => {
    if (!renameTarget) return;
    const target = renameTarget;
    setRenameTarget(null);
    void syncPatch(target, { title, titleLocked: true });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setConversations((items) => items.filter((item) => item.id !== target.id));
    if (!userId) return;
    try {
      await removeStudyConversation(
        {
          backendURL: process.env.NEXT_PUBLIC_BACKEND_URL,
          headers: await getAuthHeaders(),
        },
        userId,
        target,
      );
      setNotice("");
    } catch (error) {
      setNotice(`${studyErrorMessage(error)} Refresh to check the server copy.`);
    }
  };

  return (
    <StudyScreen
      eyebrow="Study Lab / History"
      title="Every learning conversation, easy to return to."
      description="Search, pin, rename, archive, or continue a previous doubt without crowding your active study room."
      backHref="/dashboard/study"
      aside={<StudySyncPill state={syncState} />}
    >
      <section className={styles.library} aria-labelledby="study-history-heading">
        <div className={styles.toolbar}>
          <div>
            <p>{showArchived ? "Archived conversations" : "Conversation library"}</p>
            <h2 id="study-history-heading">{showArchived ? "Saved for later" : "Continue where you stopped"}</h2>
          </div>
          <div className={styles.toolbarActions}>
            <label className={styles.search}>
              <AppIcon name="search" />
              <span className="sr-only">Search study conversations</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" />
            </label>
            <button type="button" onClick={() => setShowArchived((current) => !current)}>
              <AppIcon name={showArchived ? "arrowRight" : "history"} />
              {showArchived ? "Active" : "Archived"}
            </button>
          </div>
        </div>

        {notice ? (
          <div className={styles.notice} role="status">
            <AppIcon name="clock" />
            <span>{notice}</span>
            <button type="button" onClick={reload}>Retry sync</button>
          </div>
        ) : null}

        {filtered.length ? (
          <div className={styles.list}>
            {filtered.map((conversation) => (
              <article key={conversation.id} className={styles.row}>
                <Link href={conversationHref(conversation)} className={styles.rowMain}>
                  <span className={styles.icon}><AppIcon name={conversation.pinned ? "spark" : "study"} /></span>
                  <span className={styles.rowCopy}>
                    <span className={styles.titleLine}>
                      <strong>{conversation.title}</strong>
                      {conversation.pinned ? <small>Pinned</small> : null}
                    </span>
                    <span className={styles.scopeLine}>
                      {conversation.scope?.source === "syllabus"
                        ? `${conversation.scope.chapterLabel} / ${conversation.scope.topicLabel}`
                        : "Open tutor"}
                    </span>
                    <span className={styles.meta}>{conversation.messages.length} messages · {readableDate(conversation.updatedAt)}</span>
                  </span>
                  <span className={styles.continue}>Continue <AppIcon name="arrowRight" /></span>
                </Link>
                <div className={styles.rowActions} aria-label={`Manage ${conversation.title}`}>
                  <button type="button" onClick={() => void syncPatch(conversation, { pinned: !conversation.pinned })} aria-label={conversation.pinned ? `Unpin ${conversation.title}` : `Pin ${conversation.title}`}>
                    <AppIcon name="spark" />
                  </button>
                  <button type="button" onClick={() => setRenameTarget(conversation)} aria-label={`Rename ${conversation.title}`}>
                    <AppIcon name="copy" />
                  </button>
                  <button type="button" onClick={() => void syncPatch(conversation, { archived: !conversation.archived })} aria-label={conversation.archived ? `Restore ${conversation.title}` : `Archive ${conversation.title}`}>
                    <AppIcon name="history" />
                  </button>
                  <button type="button" className={styles.deleteButton} onClick={() => setDeleteTarget(conversation)} aria-label={`Delete ${conversation.title}`}>
                    <AppIcon name="trash" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <span><AppIcon name={search ? "search" : "history"} /></span>
            <h3>{search ? "No matching conversations" : showArchived ? "No archived conversations" : "Your conversation library is ready"}</h3>
            <p>{search ? "Try a different word or topic." : "Start a focused Study Lab session and it will appear here automatically."}</p>
            {!search && !showArchived ? <Link href="/dashboard/study">Start studying <AppIcon name="arrowRight" /></Link> : null}
          </div>
        )}
      </section>

      <RenameConversationDialog
        key={renameTarget?.id || "rename-closed"}
        open={Boolean(renameTarget)}
        initialTitle={renameTarget?.title || ""}
        onCancel={() => setRenameTarget(null)}
        onRename={confirmRename}
      />
      <StudyConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this conversation?"
        detail={deleteTarget ? `“${deleteTarget.title}” and its messages will be removed from Study Lab history.` : ""}
        confirmLabel="Delete chat"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </StudyScreen>
  );
}
