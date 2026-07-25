import PlanningWorkspace from "./PlanningWorkspace";
import { Suspense } from "react";

function PlanningFallback() {
  return (
    <div className="flex min-h-[calc(100svh-6.5rem)] items-center justify-center text-sm font-semibold text-[#0E7490]">
      Preparing Planning...
    </div>
  );
}

export default function PlanningPage() {
  return (
    <Suspense fallback={<PlanningFallback />}>
      <PlanningWorkspace />
    </Suspense>
  );
}
