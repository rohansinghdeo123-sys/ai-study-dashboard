"use client";

import { useEffect } from "react";
import { Button, ErrorState } from "@/components/ui/primitives";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error.digest, error.message]);

  return (
    <div className="flex min-h-[70svh] items-center justify-center p-4">
      <ErrorState
        title="Workspace could not load"
        detail="Something interrupted this page. Retry without leaving your AgentifyAI session."
        action={(
          <Button type="button" variant="secondary" onClick={reset}>
            Retry page
          </Button>
        )}
      />
    </div>
  );
}
