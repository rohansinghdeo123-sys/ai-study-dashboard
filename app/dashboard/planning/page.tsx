import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planning | AgentifyAI",
  description: "Build a focused, adaptive study plan for your next topic.",
  alternates: { canonical: "/dashboard/planning" },
};

export { default } from "@/features/planning/PlanningPage";
