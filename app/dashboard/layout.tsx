"use client";

import { useAuth } from "@/context/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const ADMIN_ROUTE = "/dashboard/internal/ops";

const PRIMARY_NAV = [
  { name: "Dashboard", href: "/dashboard", abbr: "D", description: "Today" },
  { name: "Study", href: "/dashboard/study", abbr: "S", description: "Tutor chat" },
  { name: "Mission", href: "/dashboard/mission", abbr: "M", description: "Guided plan" },
  { name: "Sessions", href: "/dashboard/sessions", abbr: "R", description: "History" },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isActive(pathname: string | null, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, profile, loading, claimsLoading, isAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const authReady = !loading && !claimsLoading;
  const isAdminRoute = pathname?.startsWith(ADMIN_ROUTE);
  const displayName = profile?.name || user?.displayName || user?.email?.split("@")[0] || "Student";
  const nav = [...PRIMARY_NAV, ...(isAdmin ? [{ name: "Ops", href: ADMIN_ROUTE, abbr: "O", description: "Admin" }] : [])];

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
      <div className="flex min-h-[100svh] items-center justify-center bg-[var(--color-surface-1)] text-sm text-[#0E7490]">
        <div className="rounded-2xl border border-white/40 bg-white/80 px-5 py-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          Preparing your learning space...
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (isAdminRoute && !isAdmin) return null;

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden bg-[var(--color-surface-1)] text-[var(--color-text-primary)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-[-12rem] h-[28rem] w-[28rem] rounded-full bg-[#14B8A6]/18 blur-3xl" />
        <div className="absolute right-[-10rem] top-12 h-[28rem] w-[28rem] rounded-full bg-[#F2B84B]/16 blur-3xl" />
        <div className="absolute bottom-[-16rem] left-1/3 h-[32rem] w-[32rem] rounded-full bg-[#0E7490]/12 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:72px_72px] opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.86),transparent_42%)]" />
      </div>

      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
        <div className="mx-auto flex max-w-7xl items-center gap-3 rounded-[1.6rem] border border-white/55 bg-white/76 px-3 py-3 shadow-[0_22px_70px_rgba(15,23,42,0.10)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#07111F]/82 dark:shadow-[0_22px_70px_rgba(0,0,0,0.32)]">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3 rounded-2xl px-2 py-1.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0F172A,#0E7490,#14B8A6)] text-sm font-bold text-white shadow-[0_12px_28px_rgba(14,116,144,0.24)]">
              A
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block text-sm font-semibold leading-5 text-slate-950 dark:text-white">AgentifyAI</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">Personal learning hub</span>
            </span>
          </Link>

          <nav className="mx-auto hidden items-center gap-1 rounded-2xl border border-slate-200/75 bg-slate-50/80 p-1 md:flex dark:border-white/10 dark:bg-white/[0.04]">
            {nav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                    active
                      ? "bg-white text-slate-950 shadow-[0_12px_28px_rgba(15,23,42,0.10)] dark:bg-white/10 dark:text-white"
                      : "text-slate-500 hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  }`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold ${
                    active
                      ? "bg-[#0E7490] text-white"
                      : "bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:text-slate-400 dark:ring-white/10"
                  }`}>
                    {item.abbr}
                  </span>
                  <span>
                    <span className="block leading-4">{item.name}</span>
                    <span className="block text-[10px] leading-3 opacity-65">{item.description}</span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              href="/dashboard/progress"
              className="hidden rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-[#0E7490]/30 hover:text-[#0E7490] lg:inline-flex dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            >
              Analytics
            </Link>
            <ThemeToggle compact />
            <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-2.5 py-2 md:flex dark:border-white/10 dark:bg-white/[0.04]">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0E7490]/10 text-xs font-bold text-[#0E7490]">
                {getInitials(displayName)}
              </span>
              <span className="max-w-[130px] truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName}</span>
            </div>
            <button
              onClick={logout}
              className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-rose-300/50 hover:text-rose-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-3 pb-28 pt-5 sm:px-5 md:pb-10">
        {children}
      </main>

      <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 gap-1 rounded-[1.4rem] border border-white/60 bg-white/82 p-1.5 shadow-[0_22px_70px_rgba(15,23,42,0.16)] backdrop-blur-2xl md:hidden dark:border-white/10 dark:bg-[#07111F]/90">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-2 py-2 text-center transition ${
                active ? "bg-[#0E7490] text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[0.06]"
              }`}
            >
              <span className="text-xs font-bold">{item.abbr}</span>
              <span className="mt-0.5 truncate text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
