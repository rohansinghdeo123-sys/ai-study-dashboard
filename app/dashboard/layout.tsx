"use client";

import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

const ADMIN_ROUTE = "/dashboard/internal/ops";

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
    <div className="flex h-full min-h-[720px] overflow-hidden bg-[#07080D] font-sans text-slate-200">
      <Sidebar collapsed={!sidebarOpen} onToggle={toggleSidebar} />

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

        <main className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#07080D]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.11),transparent_28%),radial-gradient(circle_at_88%_10%,rgba(245,158,11,0.08),transparent_30%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:64px_64px] opacity-45" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/[0.045] to-transparent" />
          <div className="relative z-10 mx-auto max-w-[1760px] p-4 md:p-5 xl:p-6">
            {children}
          </div>
        </main>

        <div className="flex items-center justify-between border-t border-white/10 bg-[#0B0D12]/90 px-4 py-2 text-[11px] text-slate-500 backdrop-blur-xl">
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
