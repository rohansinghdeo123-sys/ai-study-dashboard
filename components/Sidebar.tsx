"use client";

import { useAuth } from "@/context/AuthContext";
import { apiJson } from "@/lib/apiClient";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const ADMIN_ROUTE = "/dashboard/internal/admin";

type MenuItem = {
  name: string;
  href: string;
  abbr: string;
  description: string;
  adminOnly?: boolean;
};

const BASE_MENU: MenuItem[] = [
  { name: "Dashboard", href: "/dashboard", abbr: "D", description: "Command center" },
  { name: "Study Lab", href: "/dashboard/study", abbr: "S", description: "Personal AI tutor" },
  { name: "Exam Mode", href: "/dashboard/exam", abbr: "E", description: "Grounded assessment" },
  { name: "Analytics", href: "/dashboard/progress", abbr: "A", description: "Learning intelligence" },
];

const ADMIN_MENU: MenuItem = {
  name: "Admin",
  href: ADMIN_ROUTE,
  abbr: "A",
  description: "Founder console",
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
        const data = await apiJson<Record<string, number>>(`${backendURL}/get-progress/${userId}`, {
          headers: await getAuthHeaders(),
          cacheKey: `progress:${userId}`,
          cacheTtlMs: 30000,
          retries: 1,
          timeoutMs: 7000,
        });
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
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [userId, backendURL, getAuthHeaders]);

  return stats;
}

function StatRow({ label, value, tone = "text-slate-200" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-xs font-semibold ${tone}`}>{value}</span>
    </div>
  );
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
  const accuracyTone =
    stats.accuracy >= 75 ? "text-emerald-300" : stats.accuracy >= 50 ? "text-amber-300" : "text-rose-300";

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-white/10 bg-[#080A0F]/95 shadow-[inset_-1px_0_0_rgba(255,255,255,0.03)] backdrop-blur-xl transition-[width] duration-300 ${
        collapsed ? "w-[68px]" : "w-[268px]"
      }`}
    >
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-sm font-bold text-cyan-200">
              A
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">AgentifyAI</div>
                <div className="mt-0.5 text-[11px] text-slate-500">Learning OS</div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="agentify-action rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-500 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-slate-200"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? ">" : "<"}
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
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
              className={`group flex items-center gap-3 rounded-lg border px-3 py-3 transition ${
                isActive
                  ? isOps
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-200 shadow-[0_0_24px_rgba(242,184,75,0.08)]"
                    : "border-cyan-400/25 bg-cyan-400/10 text-cyan-100 shadow-[0_0_24px_rgba(20,184,166,0.08)]"
                  : "border-transparent text-slate-500 hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold ${
                  isActive
                    ? isOps
                      ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
                      : "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-slate-500 group-hover:text-slate-200"
                }`}
              >
                {item.abbr}
              </span>
              {!collapsed && (
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.name}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500">{item.description}</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="m-3 rounded-lg border border-white/10 bg-white/[0.035] p-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Live Profile</span>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Live
            </span>
          </div>
          <div className="space-y-2.5">
            <StatRow label="XP" value={stats.xp} tone="text-emerald-300" />
            <StatRow label="Level" value={stats.level} tone="text-cyan-200" />
            <StatRow label="Streak" value={`${stats.streak}d`} tone="text-amber-300" />
            <StatRow label="Accuracy" value={`${stats.accuracy}%`} tone={accuracyTone} />
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300 transition-all duration-700"
              style={{ width: `${Math.max(4, Math.min(100, stats.accuracy || 4))}%` }}
            />
          </div>
        </div>
      )}
    </aside>
  );
}
