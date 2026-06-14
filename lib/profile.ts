import type { User } from "firebase/auth";

export const CLASS_LEVELS = [
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
  "Other",
] as const;

export type ClassLevel = (typeof CLASS_LEVELS)[number] | "";

export type BackendUserProfile = {
  user_id: string;
  email: string;
  display_name: string;
  class_level: ClassLevel;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfileUpdate = Partial<
  Pick<BackendUserProfile, "display_name" | "class_level" | "onboarding_completed">
>;

export function resolveDisplayName(
  profile: BackendUserProfile | null,
  user: User | null,
) {
  return (
    profile?.display_name?.trim() ||
    user?.displayName?.trim() ||
    user?.email?.split("@")[0] ||
    "Student"
  );
}

export function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "Student";
}

export function isValidDisplayName(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length >= 2 && cleaned.length <= 80 && /\p{L}/u.test(cleaned);
}
