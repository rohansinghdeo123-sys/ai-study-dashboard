"use client";

import BackendStatus from "@/components/BackendStatus";
import ThemeToggle from "@/components/ThemeToggle";
import ChatThinkingLogo from "@/components/brand/ChatThinkingLogo";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const ADMIN_ROUTE = "/dashboard/internal/admin";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const {
    user,
    profile,
    accountProfile,
    authError,
    profileError,
    refreshProfile,
    loading,
    sessionExpired,
    isAdmin,
    logout,
  } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const authReady = !loading;
  const isAdminRoute = pathname?.startsWith("/dashboard/internal");
  const isStudyRoute = pathname?.startsWith("/dashboard/study");
  const displayName = profile?.name || user?.displayName || user?.email?.split("@")[0] || "Student";

  useEffect(() => {
    if (!authReady) return;
    if (authError || sessionExpired) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!profileError && accountProfile && !accountProfile.onboarding_completed) {
      router.replace("/onboarding");
    }
  }, [accountProfile, authError, authReady, profileError, router, sessionExpired, user]);

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
      <main id="main-content" className="flex min-h-[100svh] items-center justify-center bg-[#F8FAFC] text-sm text-[#0E7490]">
        <div className="rounded-3xl border border-white/70 bg-white/85 px-5 py-4 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
          Preparing AgentifyAI...
        </div>
      </main>
    );
  }

  if (authError) {
    return (
      <main id="main-content" className="flex min-h-[100svh] items-center justify-center bg-[var(--agentify-page-bg)] px-5 text-center">
        <div className="agentify-card max-w-lg rounded-[2rem] p-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0E7490]">Sign-in setup</p>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--agentify-primary-text)]">
            AgentifyAI sign-in needs configuration.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--agentify-muted-text)]">
            {authError}
          </p>
          <Link
            href="/login"
            className="agentify-action agentify-action-primary mt-6 inline-flex rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            Return to sign in
          </Link>
        </div>
      </main>
    );
  }

  if (sessionExpired) {
    return (
      <main id="main-content" className="flex min-h-[100svh] items-center justify-center bg-[var(--agentify-page-bg)] px-5 text-center">
        <div className="agentify-card max-w-md rounded-[2rem] p-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0E7490]">Session ended</p>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--agentify-primary-text)]">
            Please sign in again.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--agentify-muted-text)]">
            Your previous session expired, so private study content stays hidden until you reconnect.
          </p>
          <Link
            href="/login"
            className="agentify-action agentify-action-primary mt-6 inline-flex rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            Open sign in
          </Link>
        </div>
      </main>
    );
  }

  if (!user) return null;

  if (profileError || !accountProfile) {
    return (
      <main id="main-content" className="flex min-h-[100svh] items-center justify-center bg-[var(--agentify-page-bg)] px-5 text-center">
        <div className="agentify-card max-w-md rounded-[2rem] p-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0E7490]">Profile connection</p>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--agentify-primary-text)]">
            We could not prepare your account.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--agentify-muted-text)]">
            Your login is safe. Retry the profile connection to continue.
          </p>
          <button
            type="button"
            onClick={() => void refreshProfile()}
            className="agentify-action agentify-action-primary mt-6 rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            Retry connection
          </button>
        </div>
      </main>
    );
  }

  if (!accountProfile.onboarding_completed) return null;

  if (isAdminRoute) {
    return <div className="min-h-[100svh] bg-[#050812]">{children}</div>;
  }

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
          aria-label="AgentifyAI learning hub"
          className="auth-brand-lockup dashboard-brand-lockup group inline-flex items-center gap-3.5"
        >
          <ChatThinkingLogo state="thinking" size={46} className="auth-brand-logo dashboard-brand-logo" label="AgentifyAI" />
          <span className="block">
            <span className="auth-brand-name dashboard-brand-name block text-base font-extrabold leading-4 tracking-[-0.035em]">
              Agentify<span>AI</span>
            </span>
            <span className="auth-brand-tagline dashboard-brand-tagline mt-1 hidden text-[10px] font-semibold sm:block">
              Your personal study agent
            </span>
          </span>
        </Link>
      </div>

      <div className="fixed right-4 top-4 z-50 flex items-center gap-2 sm:right-6">
        <BackendStatus />
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
            Admin
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
          type="button"
          onClick={logout}
          className="agentify-action dashboard-nav-card rounded-2xl border border-white/70 bg-white/78 px-3 py-2 text-xs font-semibold text-slate-600 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:text-rose-500"
        >
          Log out
        </button>
      </div>

      <main
        id="main-content"
        className={
          isStudyRoute
            ? "relative z-10 h-[100svh] overflow-hidden px-0 py-0"
            : "relative z-10 min-h-[100svh] px-3 pb-6 pt-20 sm:px-5"
        }
      >
        {children}
      </main>
    </div>
  );
}
