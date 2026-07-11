import { describe, expect, it } from "vitest";
import type { User } from "firebase/auth";
import {
  firstName,
  isValidDisplayName,
  resolveDisplayName,
  type BackendUserProfile,
} from "@/lib/profile";

function firebaseUser(fields: Partial<User>): User {
  return fields as User;
}

const baseProfile: BackendUserProfile = {
  user_id: "user-1",
  email: "student@example.com",
  display_name: "",
  class_level: "",
  onboarding_completed: false,
  created_at: "2026-07-11T00:00:00.000Z",
  updated_at: "2026-07-11T00:00:00.000Z",
};

describe("profile helpers", () => {
  it("prefers the backend profile display name", () => {
    expect(
      resolveDisplayName(
        { ...baseProfile, display_name: "  Rohan Singh  " },
        firebaseUser({ displayName: "Firebase Name", email: "firebase@example.com" }),
      ),
    ).toBe("Rohan Singh");
  });

  it("falls back to Firebase display name, email prefix, then Student", () => {
    expect(resolveDisplayName(null, firebaseUser({ displayName: "  Aanya  " }))).toBe("Aanya");
    expect(resolveDisplayName(null, firebaseUser({ displayName: "", email: "learner@example.com" }))).toBe("learner");
    expect(resolveDisplayName(null, null)).toBe("Student");
  });

  it("extracts a safe first name for student-facing copy", () => {
    expect(firstName("  Aanya Rao  ")).toBe("Aanya");
    expect(firstName("")).toBe("Student");
  });

  it("validates display names without accepting numbers-only or excessive input", () => {
    expect(isValidDisplayName("Ro")).toBe(true);
    expect(isValidDisplayName("Aanya Rao")).toBe(true);
    expect(isValidDisplayName("7 9 11")).toBe(false);
    expect(isValidDisplayName("A")).toBe(false);
    expect(isValidDisplayName("A".repeat(81))).toBe(false);
  });
});
