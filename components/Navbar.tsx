"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

const ADMIN_ROUTE = "/dashboard/internal/ops";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getPageMeta(pathname: string | null) {
  if (pathname?.startsWith("/dashboard/study")) {
    return { title: "Study Lab", subtitle: "AI tutoring, revision, and autonomous missions" };
  }
  if (pathname?.startsWith("/dashboard/sessions")) {
    return { title: "Sessions", subtitle: "Learning records, replay, and performance review" };
  }
  if (pathname?.startsWith("/dashboard/progress")) {
    return { title: "Analytics", subtitle: "Mastery, momentum, and weak-topic intelligence" };
  }
  if (pathname?.startsWith(ADMIN_ROUTE)) {
    return { title: "Ops", subtitle: "Agent registry, telemetry, and control plane" };
  }
  return { title: "Dashboard", subtitle: "Student command center and daily learning signals" };
}

export default function Navbar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { profile, user, isAdmin, logout } = useAuth();
  const pathname = usePathname();
  const displayName = profile?.name || user?.displayName || user?.email?.split("@")[0] || "User";
  const page = getPageMeta(pathname);

  if (collapsed) {
    return (
      <header className="flex h-11 items-center justify-between border-b border-white/10 bg-[#0B0D12]/90 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          System live
        </div>
        <button
          onClick={onToggle}
          className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-slate-400 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
        >
          Expand
        </button>
      </header>
    );
  }

  return (
    <header className="border-b border-white/10 bg-[#0B0D12]/90 px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onToggle}
            className="rounded-md border border-white/10 px-2.5 py-2 text-xs text-slate-500 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-slate-100"
            title="Collapse top bar"
          >
            ^
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold text-white">{page.title}</h1>
              <span className="hidden rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-200 sm:inline-flex">
                Live
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500">{page.subtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <ThemeToggle compact />

          {isAdmin && (
            <Link
              href={ADMIN_ROUTE}
              className="hidden rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-300/15 md:inline-flex"
            >
              Ops
            </Link>
          )}

          {user && (
            <>
              <div className="hidden items-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 md:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-xs font-semibold text-cyan-100">
                  {getInitials(displayName)}
                </div>
                <div className="text-right">
                  <div className="max-w-[160px] truncate text-sm font-medium text-slate-100">{displayName}</div>
                  <div className="text-[11px] text-slate-500">{isAdmin ? "Administrator" : "Student"}</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-rose-300/30 hover:bg-rose-300/10 hover:text-rose-200"
              >
                Log out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
