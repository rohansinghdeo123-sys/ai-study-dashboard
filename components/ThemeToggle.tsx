"use client";

import { useEffect, useState } from "react";

type ThemeMode = "dark" | "light";

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem("agentify-theme") === "dark" ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("agentify-theme", theme);
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      data-theme-toggle
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="rounded-2xl border border-slate-200 bg-white/78 px-3 py-2 text-xs font-semibold text-slate-600 shadow-[0_14px_42px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-[#0E7490]/30 hover:text-[#0E7490]"
    >
      {compact ? (theme === "dark" ? "Light" : "Dark") : theme === "dark" ? "Light theme" : "Dark theme"}
    </button>
  );
}
