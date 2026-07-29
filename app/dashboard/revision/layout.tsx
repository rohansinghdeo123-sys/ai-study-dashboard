import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Revision Lab | AgentifyAI",
  description: "Guided chapter revision with clear explanations, focused notes, and interactive study tools.",
};

export default function RevisionLayout({ children }: { children: ReactNode }) {
  return children;
}
