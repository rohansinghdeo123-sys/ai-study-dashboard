"use client";

import { warmBackend } from "@/lib/apiClient";
import { useEffect, useState } from "react";

type BackendState = "checking" | "ready" | "offline";

export default function BackendStatus() {
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  const [state, setState] = useState<BackendState>("checking");

  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const health = await warmBackend(backendURL);
        if (active) setState(health.status === "online" ? "ready" : "offline");
      } catch {
        if (active) setState("offline");
      }
    };

    void check();
    const interval = window.setInterval(check, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [backendURL]);

  const label =
    state === "ready"
      ? "Backend ready"
      : state === "checking"
        ? "Waking backend"
        : "Backend unavailable";

  return (
    <span
      className={`backend-status ${state === "ready" ? "is-ready" : state === "offline" ? "is-offline" : "is-checking"}`}
      title={label}
      aria-label={label}
      role="status"
    >
      <span />
      <span className="hidden xl:inline">{label}</span>
    </span>
  );
}
