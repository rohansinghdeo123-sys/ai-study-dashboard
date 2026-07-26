import PlanningWorkspace from "./PlanningWorkspace";
import { Suspense } from "react";

function PlanningFallback() {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center text-sm font-semibold text-[#0E7490]">
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
