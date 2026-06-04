"use client";

import { AlertState, EmptyState } from "@/components/ui/Polished";
import type { ReactNode } from "react";

export const ARTIFACT_UNAVAILABLE_MESSAGE = "Artifact data not available for this section yet";

export default function ArtifactCanvas({
  topic,
  loading,
  error,
  onRetry,
  children,
}: {
  topic: string;
  loading: boolean;
  error?: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <>
      {error ? <div className="mt-4"><AlertState message={error} tone="amber" /></div> : null}
      <div className="study-scroll-pane study-artifact-scroll mt-5 min-h-0 flex-1 overflow-y-auto">
        {children || (
          <EmptyState
            icon={loading ? "clock" : "spark"}
            title={loading ? "Building your artifact" : error ? "Artifact unavailable" : "No artifact yet"}
            detail={
              loading
                ? `Preparing the focused visual study canvas for ${topic}.`
                : error
                  ? error
                : `Generate one for ${topic}. It will create simple cards and mistake checks from the selected study data.`
            }
            action={
              !loading && onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="agentify-action agentify-action-secondary rounded-2xl px-4 py-2 text-sm font-semibold"
                >
                  Try again
                </button>
              ) : null
            }
          />
        )}
      </div>
    </>
  );
}
