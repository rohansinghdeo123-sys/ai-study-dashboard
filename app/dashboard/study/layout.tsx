import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Study Lab | AgentifyAI",
  description: "Focused AI tutoring with transparent learning sources, conversation memory, and guided practice.",
};

export default function StudyLayout({ children }: { children: ReactNode }) {
  return children;
}
