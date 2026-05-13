"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useEffect, useState } from "react";

const ADMIN_ROUTE = "/dashboard/internal/ops";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("agentify-theme") as "light" | "dark" | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("agentify-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center w-8 h-8 rounded-md border border-white/20 hover:border-white/40 transition-colors text-gray-400 hover:text-white"
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM4.22 4.22a.75.75 0 011.06 0l1.06 1.06a.75.75 0 01-1.06 1.06L4.22 5.28a.75.75 0 010-1.06zM13.66 13.66a.75.75 0 011.06 0l1.06 1.06a.75.75 0 01-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zM2 10a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 012 10zM15 10a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0115 10zM4.22 15.78a.75.75 0 010-1.06l1.06-1.06a.75.75 0 111.06 1.06l-1.06 1.06a.75.75 0 01-1.06 0zM13.66 6.34a.75.75 0 010-1.06l1.06-1.06a.75.75 0 011.06 1.06l-1.06 1.06a.75.75 0 01-1.06 0z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

export default function Navbar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { profile, user, isAdmin, logout } = useAuth();

  const displayName =
    profile?.name || user?.displayName || user?.email?.split("@")[0] || "User";

  if (collapsed) {
    return (
      <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] backdrop-blur-sm px-4 py-1 h-10">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono text-terminal-400">LIVE</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={onToggle}
            className="flex items-center gap-1 text-[10px] font-mono text-terminal-400 hover:text-white transition-colors"
          >
            <span>▼</span> EXPAND
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="flex items-center justify-between border-b border-terminal-700/50 bg-terminal-800/50 backdrop-blur-sm px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className="text-terminal-400 hover:text-white transition-colors"
          title="Collapse navbar"
        >
          <span className="text-xs font-mono">▲</span>
        </button>
        <h1 className="text-xl font-bold tracking-tight text-terminal-50">AgentifyAI</h1>
      </div>

      <div className="flex items-center gap-3">
        {isAdmin && (
          <Link
            href={ADMIN_ROUTE}
            className="hidden border border-amber-400/30 bg-amber-400/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400 transition-colors hover:border-amber-400 hover:bg-amber-400/20 md:inline-flex rounded-md"
            title="Internal operations console"
          >
            OPS
          </Link>
        )}
        <ThemeToggle />

        {user && (
          <>
            <div className="hidden items-center gap-3 md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-terminal-700/50 bg-terminal-800/50 font-mono text-xs font-bold text-terminal-blue">
                {getInitials(displayName)}
              </div>
              <div className="text-right">
                <div className="text-sm text-terminal-200">{displayName}</div>
                {isAdmin && (
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber-400">
                    admin
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20"
            >
              LOGOUT
            </button>
          </>
        )}
      </div>
    </header>
  );
}