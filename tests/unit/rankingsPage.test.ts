import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("Global Rankings UI contracts", () => {
  it("uses focused tabs, a semantic leaderboard, and the truthful Rank Chase fallback", () => {
    const page = readSource("components/rankings/RankingsPage.tsx");

    expect(page).toContain('role="tablist"');
    expect(page).toContain('role="tabpanel"');
    expect(page).toContain('hidden={activeView !== "leaderboard"}');
    expect(page).toContain('hidden={activeView !== "rival"}');
    expect(page).toContain("<table");
    expect(page).toContain("<caption");
    expect(page).toContain("Live Rank Chase");
    expect(page).toContain("Rank Chase uses live all-time standings");
    expect(page).toContain("Standings could not be reached");
    expect(page).toContain("Your class:");
    expect(page).not.toContain("dashboard-rival-");
    expect(page).not.toContain("dashboard-leaderboard-");
  });

  it("keeps Rankings parent-sized, responsive, and motion-safe", () => {
    const css = readSource("components/rankings/rankings.module.css");

    expect(css).toContain("width: 100%");
    expect(css).toContain("max-width: none");
    expect(css).toContain("min-height: 100%");
    expect(css).not.toMatch(/100(?:d|s|l|v)?vh/);
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toContain("@media (max-width: 399px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
