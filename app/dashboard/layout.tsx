"use client";

import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode, useState, useCallback } from "react";

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
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        router.push(ADMIN_ROUTE);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [authReady, isAdmin, router, user]);

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);
  const toggleNavbar = useCallback(() => setNavbarOpen((prev) => !prev), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleSidebar]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        toggleNavbar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleNavbar]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-terminal-950 font-mono text-terminal-blue">
        <div className="animate-pulse">INITIALIZING TERMINAL...</div>
      </div>
    );
  }

  if (!user) return null;
  if (isAdminRoute && !isAdmin) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-terminal-950 text-terminal-50 font-sans">
      <Sidebar collapsed={!sidebarOpen} onToggle={toggleSidebar} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar collapsed={!navbarOpen} onToggle={toggleNavbar} />

        {!navbarOpen && (
          <div className="flex items-center justify-end border-b border-white/10 bg-black/30 backdrop-blur-sm px-4 py-1">
            <button
              onClick={toggleNavbar}
              className="flex items-center gap-1 text-[10px] font-mono text-gray-400 hover:text-white transition-colors"
            >
              <span>▼</span> EXPAND
            </button>
          </div>
        )}

        <main className="relative flex-1 overflow-y-auto overflow-x-hidden">
          <div className="h-full w-full">{children}</div>
        </main>

        <div className="flex items-center justify-between border-t border-white/10 bg-black/30 backdrop-blur-sm px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-gray-500">
          <div className="flex items-center gap-6">
            <span className="text-emerald-400 animate-terminal-pulse">● LIVE</span>
            <span>AI TERMINAL v1.0.4</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Ctrl+B Side · Ctrl+N Nav</span>
            {isAdmin && <span className="text-red-400">ADMIN</span>}
          </div>
        </div>
      </div>
    </div>
  );
}