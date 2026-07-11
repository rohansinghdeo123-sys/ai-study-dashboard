import { LoadingState } from "@/components/ui/primitives";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[70svh] items-center justify-center p-4">
      <LoadingState
        title="Loading workspace"
        detail="Preparing your next learning surface."
      />
    </div>
  );
}
