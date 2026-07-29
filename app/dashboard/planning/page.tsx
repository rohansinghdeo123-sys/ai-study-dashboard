import type { Metadata } from "next";
import PlanningHome from "@/features/planning/PlanningHome";

export const metadata: Metadata = {
  title: "Planning | AgentifyAI",
  description: "Build a focused, adaptive study plan for your next topic.",
  alternates: { canonical: "/dashboard/planning" },
};

export default PlanningHome;
