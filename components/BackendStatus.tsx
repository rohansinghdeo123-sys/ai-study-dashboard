"use client";

import { warmBackend } from "@/lib/apiClient";
import { useCallback, useEffect, useRef, useState } from "react";

type BackendState = "checking" | "ready" | "offline";

export default function BackendStatus() {
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  const [state, setState] = useState<BackendState>("checking");
  const [retryToken, setRetryToken] = useState(0);
  const stateRef = useRef<BackendState>("checking");

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const checkBackend = useCallback(async (active: () => boolean, forceFresh = false) => {
    try {
      if (forceFresh && active()) setState("checking");
      const health = await warmBackend(backendURL, { forceFresh });
      if (active()) setState(health.status === "online" ? "ready" : "offline");
    } catch {
      if (active()) setState("offline");
    }
  }, [backendURL]);

  useEffect(() => {
    let active = true;
    const isActive = () => active;

    void checkBackend(isActive, true);
    const interval = window.setInterval(
      () => void checkBackend(isActive, stateRef.current !== "ready"),
      15000,
    );
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [backendURL, checkBackend, retryToken]);

  const label =
    state === "ready"
      ? "Backend ready"
      : state === "checking"
        ? "Waking backend"
        : "Backend unavailable";

  return (
    <button
      type="button"
      onClick={() => setRetryToken((current) => current + 1)}
      className={`backend-status ${state === "ready" ? "is-ready" : state === "offline" ? "is-offline" : "is-checking"}`}
      title={state === "ready" ? label : "Retry backend connection"}
      aria-label={label}
      aria-live="polite"
    >
      <span />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
