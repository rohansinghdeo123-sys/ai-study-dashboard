import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("focused Exam Lab architecture", () => {
  const routes = [
    "app/dashboard/exam/page.tsx",
    "app/dashboard/exam/mcq/page.tsx",
    "app/dashboard/exam/probable/page.tsx",
    "app/dashboard/exam/papers/page.tsx",
    "app/dashboard/exam/papers/[paperId]/page.tsx",
    "app/dashboard/exam/workspace/page.tsx",
    "app/dashboard/exam/workspace/history/page.tsx",
    "app/dashboard/exam/workspace/attempts/[attemptId]/page.tsx",
  ];

  it("ships a real route for every focused workspace and secondary detail screen", () => {
    routes.forEach((route) => expect(existsSync(join(process.cwd(), route)), route).toBe(true));
  });

  it("keeps the Exam landing page as a four-destination launcher", () => {
    const hub = source("app/dashboard/exam/page.tsx");

    expect(hub).toContain("EXAM_ROUTES.mcq");
    expect(hub).toContain("EXAM_ROUTES.probable");
    expect(hub).toContain("EXAM_ROUTES.papers");
    expect(hub).toContain("EXAM_ROUTES.workspace");
    expect(hub).not.toContain("activePanel");
    expect(hub).not.toContain("generate-mcqs");
  });

  it("does not couple MCQ generation to probable-question generation", () => {
    const mcq = source("app/dashboard/exam/mcq/page.tsx");

    expect(mcq).toContain('"/generate-mcqs"');
    expect(mcq).toContain('"/submit-session"');
    expect(mcq).not.toContain("generate-probable-questions");
    expect(mcq).toContain('type="radio"');
    expect(mcq).toContain('"beforeunload"');
  });

  it("keeps the completed MCQ draft recoverable until history saving succeeds", () => {
    const mcq = source("app/dashboard/exam/mcq/page.tsx");
    const saveBlock = mcq.slice(mcq.indexOf("const persistResult"), mcq.indexOf("const submitAttempt"));

    expect(saveBlock.indexOf("await examApiRequest")).toBeGreaterThanOrEqual(0);
    expect(saveBlock.indexOf("clearMcqDraft(draftKey)")).toBeGreaterThan(saveBlock.indexOf("await examApiRequest"));
    expect(mcq).toContain("Retry save");
  });

  it("protects Exam mutations from automatic replay", () => {
    const api = source("features/exam/api.ts");

    expect(api).toContain("options.retries ?? (isRead ? 1 : 0)");
    expect(api).toContain("options.retries ?? 0");
    expect(api).toContain("invalidateExamCaches(options.invalidate)");
  });

  it("keeps answer writing, history, and feedback in separate route files", () => {
    const workspace = source("app/dashboard/exam/workspace/page.tsx");
    const history = source("app/dashboard/exam/workspace/history/page.tsx");
    const feedback = source("app/dashboard/exam/workspace/attempts/[attemptId]/page.tsx");

    expect(workspace).toContain('type WorkspaceStage = "setup" | "write" | "feedback"');
    expect(workspace).toContain("agentifyai:exam:written:v1:");
    expect(history).toContain("fetchWrittenHistory");
    expect(feedback).toContain("fetchAttemptFeedback");
  });
});
