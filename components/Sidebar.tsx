"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const ADMIN_ROUTE = "/dashboard/internal/ops";

type MenuItem = {
  name: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
};

const BASE_MENU: MenuItem[] = [
  { name: "DASHBOARD", href: "/dashboard", icon: "📊" },
  { name: "STUDY LAB", href: "/dashboard/study", icon: "🧪" },
  { name: "SESSIONS", href: "/dashboard/sessions", icon: "🕒" },
  { name: "ANALYTICS", href: "/dashboard/progress", icon: "📈" },
];

const ADMIN_MENU: MenuItem = {
  name: "OPS",
  href: ADMIN_ROUTE,
  icon: "⚡",
  adminOnly: true,
};

function useLiveStats(
  userId: string | undefined,
  backendURL: string | undefined | null,
  getAuthHeaders: () => Promise<HeadersInit>,
) {
  const [stats, setStats] = useState({ xp: 0, level: 1, streak: 0, accuracy: 0 });
  useEffect(() => {
    if (!userId || !backendURL) return;
    let active = true;
    const fetchStats = async () => {
      try {
        const res = await fetch(`${backendURL}/get-progress/${userId}`, {
          cache: "no-store",
          headers: await getAuthHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const xp = data.xp ?? 0;
        const level = Math.floor(xp / 100) + 1;
        const streak = data.streak ?? 0;
        const totalQ = data.total_questions ?? 0;
        const totalC = data.total_correct ?? 0;
        const accuracy = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0;
        setStats({ xp, level, streak, accuracy });
      } catch {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => { active = false; clearInterval(interval); };
  }, [userId, backendURL, getAuthHeaders]);
  return stats;
}

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { isAdmin, claimsLoading, user, getAuthHeaders } = useAuth();
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  const menu = useMemo(() => {
    if (claimsLoading || !isAdmin) return BASE_MENU;
    return [...BASE_MENU, ADMIN_MENU];
  }, [claimsLoading, isAdmin]);

  const stats = useLiveStats(user?.uid, backendURL, getAuthHeaders);

  return (
    <aside
      className={`flex h-full flex-col border-r border-white/10 bg-black/30 backdrop-blur-lg transition-all duration-300 ${
        collapsed ? "w-[52px]" : "w-[200px]"
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 p-3">
        {!collapsed && (
          <div>
            <div className="font-mono text-[11px] font-bold tracking-wider text-[#00A3FF]">
              AI TERMINAL
            </div>
            <div className="font-mono text-[8px] text-gray-600">v1.0.4-STABLE</div>
          </div>
        )}
        <button
          onClick={onToggle}
          className={`text-gray-500 hover:text-white transition-colors ${
            collapsed ? "mx-auto" : ""
          }`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="text-xs font-mono">{collapsed ? "»" : "«"}</span>
        </button>
      </div>

      <nav className="flex-1 space-y-[1px] py-2">
        {menu.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          const isOps = item.adminOnly === true;

          return (
            <Link
              key={item.name}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={`flex items-center gap-2.5 border-l-2 px-3 py-2 font-mono text-[11px] transition-all duration-150 ${
                isActive
                  ? isOps
                    ? "border-red-500 bg-red-500/10 text-red-400"
                    : "border-[#00A3FF] bg-[#0F1A24] text-[#00A3FF]"
                  : isOps
                    ? "border-transparent text-gray-500 hover:bg-red-500/5 hover:text-red-400"
                    : "border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300"
              }`}
            >
              <span className="text-sm">{item.icon}</span>
              {!collapsed && <span className="font-bold tracking-wider">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-white/10 p-3 space-y-3 bg-white/5">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-500">
            LIVE STATS
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">XP</span>
              <span className="text-emerald-400 font-bold">{stats.xp}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">LVL</span>
              <span className="text-[#00A3FF] font-bold">{stats.level}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">STREAK</span>
              <span className="text-amber-400 font-bold">{stats.streak}d</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">ACC</span>
              <span className={`font-bold ${stats.accuracy >= 75 ? "text-emerald-400" : stats.accuracy >= 50 ? "text-amber-400" : "text-red-400"}`}>
                {stats.accuracy}%
              </span>
            </div>
          </div>
          <div className="border-t border-white/10 pt-2">
            <div className="flex items-center justify-between font-mono text-[9px]">
              <span className="text-gray-600">SYS</span>
              <span className="flex items-center gap-1 text-emerald-400">● LIVE</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
