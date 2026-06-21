"use client";

import { isBackendRecentlyReady, warmBackend } from "@/lib/apiClient";
import { useCallback, useEffect, useRef, useState } from "react";

type BackendState = "checking" | "ready";

export default function BackendStatus() {
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  const [state, setState] = useState<BackendState>("checking");
  const stateRef = useRef<BackendState>("checking");

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const checkBackend = useCallback(async (active: () => boolean, forceFresh = false) => {
    try {
      if (isBackendRecentlyReady(backendURL) && !forceFresh) {
        if (active()) setState("ready");
        return;
      }
      if (active()) setState("checking");
      const health = await warmBackend(backendURL, {
        timeoutMs: forceFresh ? 6000 : 3500,
        forceFresh,
      });
      if (active() && health) setState("ready");
    } catch {
      if (active()) setState("checking");
    }
  }, [backendURL]);

  useEffect(() => {
    let active = true;
    const isActive = () => active;

    const kickoff = window.setTimeout(
      () => void checkBackend(isActive, !isBackendRecentlyReady(backendURL)),
      0,
    );
    const interval = window.setInterval(
      () => void checkBackend(isActive, stateRef.current !== "ready"),
      stateRef.current === "ready" ? 45000 : 18000,
    );
    return () => {
      active = false;
      window.clearTimeout(kickoff);
      window.clearInterval(interval);
    };
  }, [backendURL, checkBackend]);

  const label = state === "ready" ? "Backend ready" : "Starting backend";

  return (
    <div
      className={`backend-status ${state === "ready" ? "is-ready" : "is-checking"}`}
      title={label}
      aria-label={label}
      aria-live="polite"
    >
      <span />
      <span className="hidden xl:inline">{label}</span>
    </div>
  );
}
