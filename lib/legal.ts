export const LEGAL_EFFECTIVE_DATE = "July 11, 2026";
export const LEGAL_VERSION = "2026-07-11";
export const LEGAL_CONSENT_STORAGE_KEY = "agentifyai:legal-consent:v1";

export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@agentifyai.app";

function mailto(subject: string, body: string) {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
}

export const DATA_REQUEST_LINKS = [
  {
    label: "Request data export",
    href: mailto(
      "AgentifyAI data export request",
      "Please help me export the study data connected to my AgentifyAI account. I will reply from my verified account email or phone.",
    ),
    detail:
      "Handled by support until a self-serve export API is available in the product.",
  },
  {
    label: "Request account deletion",
    href: mailto(
      "AgentifyAI account deletion request",
      "Please help me delete the account and study data connected to my AgentifyAI account. I understand identity verification may be required.",
    ),
    detail:
      "Deletion requires identity verification and backend support; the frontend does not show fake instant deletion.",
  },
  {
    label: "Review learning history",
    href: "/dashboard/progress",
    detail:
      "Sign in to review progress, tests, practice history, and learning signals available in the dashboard.",
  },
] as const;

export const STUDENT_PRIVACY_COMMITMENTS = [
  "We do not sell student study data.",
  "We use study activity to personalize learning, revision, analytics, and AI tutoring.",
  "We do not intentionally log credentials, private documents, or full prompts for marketing.",
  "AI-generated educational content is guidance for learning and should be checked by the student, teacher, or guardian where needed.",
] as const;
