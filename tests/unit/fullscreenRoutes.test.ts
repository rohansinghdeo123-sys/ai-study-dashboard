import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("authenticated full-screen route contracts", () => {
  it("does not restore obsolete shell and study top offsets", () => {
    const css = readSource("app/globals.css");

    expect(css).not.toContain(
      ".dashboard-shell > main:not(:has(.study-lab-shell))",
    );
    expect(css).not.toMatch(/padding-top:\s*(?:4\.85|6\.5|8|9\.5)rem\s*!important/);
    expect(css).not.toMatch(
      /\.dashboard-shell\s+\.study-chat-scroll\s*\{[^}]*padding-top/,
    );
    expect(css).not.toMatch(
      /\.study-mode-fullscreen\s*\{[^}]*padding-top/,
    );
    expect(css).not.toMatch(
      /\.dashboard-shell(?::has\([^)]*study-lab-shell[^)]*\))?[^{}]*\{[^}]*100svh/,
    );
    expect(css).not.toMatch(
      /\.dashboard-shell\s+\.study-lab-shell\s*\{[^}]*height:\s*100svh/,
    );
  });

  it("sizes Planning from its parent and keeps scrolling inside its panels", () => {
    const css = readSource("features/planning/planning.module.css");
    const fallback = readSource("features/planning/PlanningPage.tsx");

    expect(css).not.toMatch(/100(?:d|s|l)?vh/);
    expect(css).toMatch(/\.screen\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/\.scroll\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/);
    expect(fallback).toContain("h-full min-h-0 w-full");
    expect(fallback).not.toContain("100svh");
  });

  it("keeps every focused Exam workspace parent-sized with one route scroll owner", () => {
    const sharedCss = readSource("components/exam/exam-screen.module.css");
    const hubCss = readSource("app/dashboard/exam/hub.module.css");
    const mcqCss = readSource("app/dashboard/exam/mcq/mcq.module.css");
    const writtenCss = readSource("app/dashboard/exam/workspace/workspace.module.css");
    const combined = [sharedCss, hubCss, mcqCss, writtenCss].join("\n");

    expect(combined).not.toMatch(/100(?:d|s|l)?vh/);
    expect(sharedCss).toMatch(/\.screen\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/);
    expect(hubCss).toMatch(/\.hub\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/);
    expect(mcqCss).toMatch(/\.workspace\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0/);
    expect(writtenCss).toMatch(/\.page\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0[^}]*overflow:\s*hidden/);
    expect(writtenCss).toMatch(/\.frame\s*\{[^}]*height:\s*100%[^}]*overflow-y:\s*auto/);
  });

  it("keeps Revision parent-sized with one route scroll owner and no nested viewport math", () => {
    const sharedCss = readSource("components/revision/revision-screen.module.css");
    const hubCss = readSource("app/dashboard/revision/hub.module.css");
    const sessionCss = readSource("app/dashboard/revision/[chapterSlug]/session.module.css");
    const toolsCss = readSource("app/dashboard/revision/[chapterSlug]/tools/tools.module.css");
    const artifactCss = readSource("components/revision/revision-artifacts.module.css");
    const combined = [sharedCss, hubCss, sessionCss, toolsCss, artifactCss].join("\n");

    expect(combined).not.toMatch(/100(?:d|s|l)?vh/);
    expect(sharedCss).toMatch(/\.screen\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0[^}]*overflow:\s*hidden/);
    expect(sharedCss).toMatch(/\.frame\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/);
    expect(hubCss).toMatch(/\.hub\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/);
  });

  it("redirects legacy dashboard routes on the server", () => {
    const missionRoute = readSource("app/dashboard/mission/page.tsx");
    const adminRoute = readSource("app/dashboard/admin/page.tsx");

    expect(missionRoute).toContain('redirect("/dashboard/planning")');
    expect(adminRoute).toContain('redirect("/dashboard/internal/admin")');
    expect(missionRoute).not.toContain('"use client"');
    expect(adminRoute).not.toContain('"use client"');
  });
});
