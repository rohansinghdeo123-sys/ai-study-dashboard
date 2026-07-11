"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

export const STUDY_DRAFT_STORAGE_PREFIX = "agentify-study-draft";

export function getStudyDraftStorageKey(userId?: string, conversationId?: string) {
  if (!userId || !conversationId) return "";
  return `${STUDY_DRAFT_STORAGE_PREFIX}:${userId}:${conversationId}`;
}

export function useStudyDraftPersistence({
  userId,
  conversationId,
  value,
  onRestore,
}: {
  userId?: string;
  conversationId?: string;
  value: string;
  onRestore: (draft: string) => void;
}) {
  const draftKey = useMemo(
    () => getStudyDraftStorageKey(userId, conversationId),
    [conversationId, userId],
  );
  const restoredKeyRef = useRef("");

  useEffect(() => {
    if (!draftKey || restoredKeyRef.current === draftKey) return;
    restoredKeyRef.current = draftKey;

    try {
      const stored = localStorage.getItem(draftKey);
      if (stored) onRestore(stored);
    } catch {
      // Draft persistence is a convenience layer; losing local storage should not block chat.
    }
  }, [draftKey, onRestore]);

  useEffect(() => {
    if (!draftKey) return;

    try {
      if (value.trim()) {
        localStorage.setItem(draftKey, value);
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch {
      // Ignore storage failures so the composer remains usable in restricted browsers.
    }
  }, [draftKey, value]);

  const clearDraft = useCallback(
    (targetConversationId = conversationId) => {
      const targetKey = getStudyDraftStorageKey(userId, targetConversationId);
      if (!targetKey) return;

      try {
        localStorage.removeItem(targetKey);
      } catch {
        // Nothing to recover; the in-memory composer state is already authoritative.
      }
    },
    [conversationId, userId],
  );

  return {
    clearDraft,
    draftKey,
  };
}
