"use client";

import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

const ADMIN_ROUTE = "/dashboard/internal/ops";

const MOBILE_NAV = [
  { name: "Home", href: "/dashboard", abbr: "D" },
  { name: "Study", href: "/dashboard/study", abbr: "S" },
  { name: "Sessions", href: "/dashboard/sessions", abbr: "R" },
  { name: "Analytics", href: "/dashboard/progress", abbr: "A" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, claimsLoading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [navbarOpen, setNavbarOpen] = useState(true);

  const authReady = !loading && !claimsLoading;
  const isAdminRoute = pathname?.startsWith(ADMIN_ROUTE);

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

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);
  const toggleNavbar = useCallback(() => setNavbarOpen((prev) => !prev), []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleSidebar]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        toggleNavbar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleNavbar]);

  if (!authReady) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#07080D] text-sm text-cyan-200">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 shadow-2xl shadow-black/20">
          Loading AgentifyAI...
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (isAdminRoute && !isAdmin) return null;

  return (
    <div className="flex min-h-[100svh] bg-[#07080D] font-sans text-slate-200 md:h-full md:min-h-[720px] md:overflow-hidden">
      <div className="hidden md:flex">
        <Sidebar collapsed={!sidebarOpen} onToggle={toggleSidebar} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar collapsed={!navbarOpen} onToggle={toggleNavbar} />

        {!navbarOpen && (
          <div className="flex items-center justify-end border-b border-white/10 bg-[#0B0D12]/90 px-4 py-1">
            <button
              onClick={toggleNavbar}
              className="rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-white/[0.04] hover:text-white"
            >
              Expand top bar
            </button>
          </div>
        )}

        <main className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#07080D] pb-20 md:pb-0">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(20,184,166,0.11),transparent_28%),radial-gradient(circle_at_88%_10%,rgba(242,184,75,0.08),transparent_30%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:64px_64px] opacity-45" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/[0.045] to-transparent" />
          <div className="relative z-10 mx-auto max-w-[1760px] p-3 sm:p-4 md:p-5 xl:p-6">
            {children}
          </div>
        </main>

        <nav className={`fixed inset-x-3 bottom-3 z-40 grid gap-1 rounded-2xl border border-white/10 bg-[#090C12]/92 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl md:hidden ${isAdmin ? "grid-cols-5" : "grid-cols-4"}`}>
          {[...MOBILE_NAV, ...(isAdmin ? [{ name: "Ops", href: ADMIN_ROUTE, abbr: "O" }] : [])].slice(0, 5).map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-0 flex-col items-center justify-center rounded-xl px-2 py-2 text-center transition ${
                  active
                    ? "bg-cyan-300/12 text-cyan-100"
                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold ${
                  active ? "border-cyan-300/25 bg-cyan-300/10" : "border-white/10 bg-white/[0.03]"
                }`}>
                  {item.abbr}
                </span>
                <span className="mt-1 truncate text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center justify-between border-t border-white/10 bg-[#0B0D12]/90 px-4 py-2 text-[11px] text-slate-500 backdrop-blur-xl md:flex">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Live
            </span>
            <span>AgentifyAI v1.0.4</span>
          </div>
          <div className="hidden items-center gap-4 sm:flex">
            <span>Ctrl+B sidebar, Ctrl+N top bar</span>
            {isAdmin && <span className="text-amber-300">Admin</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
