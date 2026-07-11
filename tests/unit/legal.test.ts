import { describe, expect, it } from "vitest";
import {
  DATA_REQUEST_LINKS,
  LEGAL_CONSENT_STORAGE_KEY,
  LEGAL_VERSION,
  STUDENT_PRIVACY_COMMITMENTS,
} from "@/lib/legal";

describe("legal configuration", () => {
  it("uses a versioned local consent storage key", () => {
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(LEGAL_CONSENT_STORAGE_KEY).toContain("legal-consent");
  });

  it("exposes honest student data commitments", () => {
    expect(STUDENT_PRIVACY_COMMITMENTS.join(" ")).toContain("We do not sell");
    expect(STUDENT_PRIVACY_COMMITMENTS.join(" ")).toContain("AI-generated educational content");
  });

  it("provides real request entry points for export, deletion, and learning history", () => {
    const labels = DATA_REQUEST_LINKS.map((item) => item.label);

    expect(labels).toContain("Request data export");
    expect(labels).toContain("Request account deletion");
    expect(labels).toContain("Review learning history");
    expect(DATA_REQUEST_LINKS.find((item) => item.label === "Request data export")?.href).toMatch(/^mailto:/);
    expect(DATA_REQUEST_LINKS.find((item) => item.label === "Request account deletion")?.href).toMatch(/^mailto:/);
    expect(DATA_REQUEST_LINKS.find((item) => item.label === "Review learning history")?.href).toBe("/dashboard/progress");
  });
});
