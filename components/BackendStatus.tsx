"use client";

import { ensureBackendReady, isBackendRecentlyReady, primeBackend } from "@/lib/apiClient";
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
      const health = await ensureBackendReady(backendURL, {
        timeoutMs: forceFresh ? 26000 : 14000,
        pollMs: 1300,
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

    primeBackend(backendURL);
    const kickoff = window.setTimeout(
      () => void checkBackend(isActive, !isBackendRecentlyReady(backendURL)),
      0,
    );
    const interval = window.setInterval(
      () => void checkBackend(isActive, stateRef.current !== "ready"),
      stateRef.current === "ready" ? 30000 : 9000,
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
