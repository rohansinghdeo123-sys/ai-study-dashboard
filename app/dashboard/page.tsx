import { LearningJourney } from "@/features/learning-workspace";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learning Journey | AgentifyAI",
  description: "Move through Planning, Study, Revision, and Exam in one connected learning journey.",
};

export default function DashboardPage() {
  return <LearningJourney />;
}
