import { describe, expect, it } from "vitest";
import {
  getConversationDeleteKeys,
  getHistoryStorageKey,
  mergeConversations,
  normalizeServerConversation,
  titleFromMessages,
} from "@/features/study/conversationUtils";
import { getStudyDraftStorageKey } from "@/features/study/hooks/useStudyDraftPersistence";
import type { StudyConversation } from "@/features/study/types";

function conversation(fields: Partial<StudyConversation>): StudyConversation {
  return {
    id: fields.id ?? "conversation",
    title: fields.title ?? "Conversation",
    updatedAt: fields.updatedAt ?? "2026-01-01T00:00:00.000Z",
    chapter: fields.chapter ?? "Open tutor",
    topic: fields.topic ?? "Any subject",
    messages: fields.messages ?? [],
    ...fields,
  };
}

describe("study conversation utilities", () => {
  it("keeps history and draft storage keys scoped by user and conversation", () => {
    expect(getHistoryStorageKey("student-1")).toBe("agentify-study-history-student-1");
    expect(getStudyDraftStorageKey("student-1", "chat-1")).toBe("agentify-study-draft:student-1:chat-1");
    expect(getStudyDraftStorageKey("", "chat-1")).toBe("");
  });

  it("builds short conversation titles from the first user message", () => {
    expect(titleFromMessages([])).toBe("New study conversation");
    expect(titleFromMessages([{ role: "coach", content: "Hello", timestamp: "" }])).toBe("New study conversation");
    expect(titleFromMessages([{ role: "user", content: "Explain hydrocarbons simply", timestamp: "" }])).toBe("Explain hydrocarbons simply");
  });

  it("normalizes backend conversations without changing the existing shape", () => {
    const normalized = normalizeServerConversation({
      id: "server-chat",
      sessionId: "session-1",
      title: "Saved chat",
      updatedAt: "2026-01-02T00:00:00.000Z",
      messages: [
        { role: "user", content: "What is an alkane?", timestamp: "now" },
        { role: "assistant", content: "Ignored", timestamp: "now" },
      ],
    });

    expect(normalized?.id).toBe("server-chat");
    expect(normalized?.sessionId).toBe("session-1");
    expect(normalized?.messages).toHaveLength(1);
    expect(normalized?.messages[0]?.role).toBe("user");
  });

  it("merges, deduplicates, pins, and sorts conversations", () => {
    const merged = mergeConversations(
      [
        conversation({ id: "newer", updatedAt: "2026-01-03T00:00:00.000Z" }),
        conversation({ id: "pinned", pinned: true, updatedAt: "2026-01-01T00:00:00.000Z" }),
      ],
      [
        conversation({ id: "newer", title: "Duplicate" }),
        conversation({ id: "older", updatedAt: "2026-01-01T00:00:00.000Z" }),
      ],
    );

    expect(merged.map((item) => item.id)).toEqual(["pinned", "newer", "older"]);
  });

  it("uses both local and backend ids when deleting synced conversations", () => {
    expect(getConversationDeleteKeys({ id: "local", sessionId: "server" })).toEqual(["local", "server"]);
    expect(getConversationDeleteKeys({ id: "local" })).toEqual(["local"]);
  });
});
