import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { primitiveNames } from "@/components/ui/primitives";

const css = readFileSync(
  join(process.cwd(), "app/styles/design-system.css"),
  "utf8",
);

const requiredTokens = [
  "--ds-bg-app",
  "--ds-bg-subtle",
  "--ds-surface",
  "--ds-surface-elevated",
  "--ds-surface-overlay",
  "--ds-border",
  "--ds-border-subtle",
  "--ds-text-primary",
  "--ds-text-secondary",
  "--ds-text-muted",
  "--ds-text-disabled",
  "--ds-accent-teal",
  "--ds-accent-gold",
  "--ds-success",
  "--ds-warning",
  "--ds-danger",
  "--ds-info",
  "--ds-focus-ring",
  "--ds-shadow-md",
  "--ds-radius-md",
  "--ds-duration-normal",
  "--ds-breakpoint-md",
  "--ds-z-overlay",
] as const;

describe("design system contract", () => {
  it("defines the semantic token groups used across the frontend", () => {
    for (const token of requiredTokens) {
      expect(css).toContain(token);
    }
  });

  it("defines reusable component classes for shared primitives", () => {
    for (const className of [
      ".ds-card",
      ".ds-button",
      ".ds-button:focus-visible",
      ".ds-button:active",
      ".ds-icon-button",
      ".ds-icon-button:focus-visible",
      ".ds-field",
      ".ds-field:disabled",
      ".ds-badge",
      ".ds-alert",
      ".ds-table",
      ".ds-skeleton",
    ]) {
      expect(css).toContain(className);
    }
  });

  it("respects reduced-motion preferences for shared animated primitives", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation: none !important");
    expect(css).toContain("transition: none !important");
  });

  it("exports the expected primitive surface", () => {
    expect(primitiveNames).toEqual([
      "Button",
      "IconButton",
      "Input",
      "Textarea",
      "Select",
      "Checkbox",
      "Radio",
      "Switch",
      "Tabs",
      "Dialog",
      "Drawer",
      "Dropdown",
      "Popover",
      "Tooltip",
      "Toast",
      "Alert",
      "Card",
      "Badge",
      "Table",
      "Pagination",
      "Skeleton",
      "EmptyState",
      "ErrorState",
      "LoadingState",
      "ProgressIndicator",
      "SourceCard",
      "ChartContainer",
      "FormField",
      "FileUpload",
      "ConfirmDialog",
    ]);
  });
});
