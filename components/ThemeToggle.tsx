"use client";

import { useSyncExternalStore } from "react";

type ThemeMode = "dark" | "light";
const THEME_CHANGE_EVENT = "agentify-theme-change";

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem("agentify-theme") === "dark" ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("agentify-theme", theme);
}

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribeToTheme, getStoredTheme, () => "light");

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      data-theme-toggle
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="agentify-action ds-icon-button theme-toggle-button px-3"
    >
      {compact ? (theme === "dark" ? "Light" : "Dark") : theme === "dark" ? "Light theme" : "Dark theme"}
    </button>
  );
}
