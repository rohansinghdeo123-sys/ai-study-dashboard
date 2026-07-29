import PlanningBuilder from "@/features/planning/PlanningBuilder";
import { PlanningLoading } from "@/features/planning/PlanningScreen";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Build a Plan | AgentifyAI",
  description: "Choose one learning target and build a realistic focused route.",
};

export default function PlanningBuilderPage() {
  return (
    <Suspense fallback={<PlanningLoading label="Preparing your plan builder..." />}>
      <PlanningBuilder />
    </Suspense>
  );
}
