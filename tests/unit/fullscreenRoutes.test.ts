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
    const css = readSource("features/planning/planning-market.module.css");
    const fallback = readSource("features/planning/PlanningPage.tsx");

    expect(css).not.toContain("--planning-viewport-height");
    expect(css).not.toContain("max-width: 100rem");
    expect(css).toMatch(/\.workspace\s*\{[^}]*height:\s*100%/);
    expect(css).toMatch(/\.canvasBody\s*\{[^}]*overflow-y:\s*auto/);
    expect(fallback).toContain("h-full min-h-0 w-full");
    expect(fallback).not.toContain("100svh");
  });

  it("keeps the focused Exam attempt in a parent-sized flex chain", () => {
    const css = readSource("app/dashboard/exam/market.module.css");

    expect(css).not.toContain("calc(100dvh");
    expect(css).toContain(
      "padding-top: max(4.15rem, calc(env(safe-area-inset-top) + 3.55rem))",
    );
    expect(css).toMatch(
      /\.workspace\[data-phase="results"\]\s*\{[^}]*padding-top:\s*max\(4\.15rem/,
    );
    expect(css).toMatch(
      /\.workspace\[data-phase="attempt"\][\s\S]*?\.exam-mode-content[\s\S]*?overflow-y:\s*auto/,
    );
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
