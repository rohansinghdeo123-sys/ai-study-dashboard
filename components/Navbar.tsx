"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useEffect, useState } from "react";

const ADMIN_ROUTE = "/dashboard/internal/ops";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Removed theme toggle – only dark mode
function ThemeToggle() {
  // No toggle, just a dummy placeholder or remove entirely
  return null;
}

export default function Navbar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { profile, user, isAdmin, logout } = useAuth();
  const displayName = profile?.name || user?.displayName || user?.email?.split("@")[0] || "User";

  if (collapsed) {
    return (
      <header className="flex items-center justify-between border-b border-white/10 bg-black/30 backdrop-blur-sm px-4 py-1 h-10">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono text-gray-400">LIVE</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggle} className="flex items-center gap-1 text-[10px] font-mono text-gray-400 hover:text-white transition-colors">
            <span>▼</span> EXPAND
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-black/30 backdrop-blur-sm px-4 py-3">
      <div className="flex items-center gap-3">
        <button onClick={onToggle} className="text-gray-400 hover:text-white transition-colors">
          <span className="text-xs font-mono">▲</span>
        </button>
        <h1 className="text-xl font-bold tracking-tight text-white">AgentifyAI</h1>
      </div>

      <div className="flex items-center gap-3">
        {isAdmin && (
          <Link href={ADMIN_ROUTE} className="hidden md:inline-flex border border-amber-400/30 bg-amber-400/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400 hover:bg-amber-400/20 rounded-md">
            OPS
          </Link>
        )}

        {user && (
          <>
            <div className="hidden md:flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 font-mono text-xs font-bold text-[#00A3FF]">
                {getInitials(displayName)}
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-200">{displayName}</div>
                {isAdmin && <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber-400">admin</div>}
              </div>
            </div>
            <button onClick={logout} className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20">
              LOGOUT
            </button>
          </>
        )}
      </div>
    </header>
  );
}