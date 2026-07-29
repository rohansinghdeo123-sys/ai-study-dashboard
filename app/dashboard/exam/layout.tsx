import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Exam Lab | AgentifyAI",
  description: "Focused MCQ, probable-question, paper-analysis, and written-answer workspaces.",
};

export default function ExamLayout({ children }: { children: ReactNode }) {
  return children;
}
