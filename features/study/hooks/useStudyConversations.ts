"use client";

import { useAuth } from "@/context/AuthContext";
import { listStudyConversations } from "@/features/study/api";
import {
  getHistoryStorageKey,
  mergeConversations,
} from "@/features/study/conversationUtils";
import type { StudyConversation } from "@/features/study/types";
import { useCallback, useEffect, useState } from "react";

export type StudyConversationSyncState = "loading" | "synced" | "offline";

function readLocalConversations(userId: string) {
  try {
    const stored = localStorage.getItem(getHistoryStorageKey(userId));
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 40) as StudyConversation[] : [];
  } catch {
    return [];
  }
}

export function writeLocalConversations(userId: string, conversations: StudyConversation[]) {
  try {
    localStorage.setItem(getHistoryStorageKey(userId), JSON.stringify(conversations.slice(0, 40)));
  } catch {
    // Local history is a resilience layer; storage restrictions must not block Study Lab.
  }
}

export function useStudyConversations() {
  const { userId, loading, authLoading, getAuthHeaders } = useAuth() as ReturnType<typeof useAuth> & { authLoading?: boolean };
  const [conversations, setConversationsState] = useState<StudyConversation[]>([]);
  const [syncState, setSyncState] = useState<StudyConversationSyncState>("loading");
  const [localReady, setLocalReady] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const authBusy = loading || authLoading;

  const setConversations = useCallback((updater: StudyConversation[] | ((items: StudyConversation[]) => StudyConversation[])) => {
    setConversationsState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      if (userId) writeLocalConversations(userId, next);
      return next;
    });
  }, [userId]);

  const reload = useCallback(() => setReloadToken((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      if (!userId) {
        setConversationsState([]);
        setLocalReady(true);
        setSyncState(authBusy ? "loading" : "offline");
        return;
      }

      const local = readLocalConversations(userId);
      setConversationsState(local);
      setLocalReady(true);
      setSyncState("loading");
      if (authBusy) return;

      try {
        const server = await listStudyConversations(
          {
            backendURL: process.env.NEXT_PUBLIC_BACKEND_URL,
            headers: await getAuthHeaders(),
          },
          userId,
        );
        if (!active) return;
        const merged = mergeConversations(server, local);
        setConversationsState(merged);
        writeLocalConversations(userId, merged);
        setSyncState("synced");
      } catch {
        if (active) setSyncState("offline");
      }
    })();

    return () => {
      active = false;
    };
  }, [authBusy, getAuthHeaders, reloadToken, userId]);

  return {
    conversations,
    setConversations,
    syncState,
    localReady,
    reload,
  };
}
