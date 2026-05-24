"use client";

import ThemeToggle from "@/components/ThemeToggle";
import StudentGuide from "@/components/StudentGuide";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const ADMIN_ROUTE = "/dashboard/internal/ops";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, profile, loading, claimsLoading, isAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const authReady = !loading && !claimsLoading;
  const isAdminRoute = pathname?.startsWith(ADMIN_ROUTE);
  const displayName = profile?.name || user?.displayName || user?.email?.split("@")[0] || "Student";

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (isAdminRoute && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [authReady, isAdmin, isAdminRoute, router, user]);

  useEffect(() => {
    if (!authReady || !user || !isAdmin) return;
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        router.push(ADMIN_ROUTE);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [authReady, isAdmin, router, user]);

  if (!authReady) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-[#F8FAFC] text-sm text-[#0E7490]">
        <div className="rounded-3xl border border-white/70 bg-white/85 px-5 py-4 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
          Preparing AgentifyAI...
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (isAdminRoute && !isAdmin) return null;

  return (
    <div className="dashboard-shell relative min-h-[100svh] overflow-x-hidden bg-[#F8FAFC] text-slate-950">
      <div className="dashboard-ambient pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-[-12rem] h-[32rem] w-[32rem] rounded-full bg-[#14B8A6]/18 blur-3xl" />
        <div className="absolute right-[-12rem] top-8 h-[34rem] w-[34rem] rounded-full bg-[#F2B84B]/16 blur-3xl" />
        <div className="absolute bottom-[-18rem] left-1/3 h-[36rem] w-[36rem] rounded-full bg-[#0E7490]/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:76px_76px] opacity-45" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.88),transparent_48%)]" />
      </div>

      <div className="fixed left-4 top-4 z-50 flex items-center gap-2 sm:left-6">
        <Link
          href="/dashboard"
          className="dashboard-nav-card flex items-center gap-2 rounded-2xl border border-white/70 bg-white/78 px-3 py-2 shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur-2xl transition hover:-translate-y-0.5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0F172A,#0E7490,#14B8A6)] text-sm font-bold text-white">
            A
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm font-semibold leading-4 text-slate-950">AgentifyAI</span>
            <span className="block text-[11px] text-slate-500">Home hub</span>
          </span>
        </Link>
      </div>

      <div className="fixed right-4 top-4 z-50 flex items-center gap-2 sm:right-6">
        <StudentGuide isAdmin={isAdmin} />
        <Link
          href="/dashboard/progress"
          className="dashboard-nav-card hidden rounded-2xl border border-white/70 bg-white/78 px-3 py-2 text-xs font-semibold text-slate-600 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:text-[#0E7490] sm:inline-flex"
        >
          Analytics
        </Link>
        {isAdmin ? (
          <Link
            href={ADMIN_ROUTE}
            className="dashboard-nav-card hidden rounded-2xl border border-amber-300/50 bg-amber-100/70 px-3 py-2 text-xs font-semibold text-amber-800 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition hover:-translate-y-0.5 md:inline-flex"
          >
            Ops
          </Link>
        ) : null}
        <ThemeToggle compact />
        <div className="dashboard-nav-card hidden items-center gap-2 rounded-2xl border border-white/70 bg-white/78 px-2.5 py-2 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0E7490]/10 text-xs font-bold text-[#0E7490]">
            {getInitials(displayName)}
          </span>
          <span className="max-w-[130px] truncate text-sm font-semibold text-slate-900">{displayName}</span>
        </div>
        <button
          onClick={logout}
          className="dashboard-nav-card rounded-2xl border border-white/70 bg-white/78 px-3 py-2 text-xs font-semibold text-slate-600 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:text-rose-500"
        >
          Log out
        </button>
      </div>

      <main className="relative z-10 min-h-[100svh] px-3 pb-6 pt-20 sm:px-5">
        {children}
      </main>
    </div>
  );
}
