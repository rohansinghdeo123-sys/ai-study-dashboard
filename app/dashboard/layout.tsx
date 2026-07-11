"use client";

import AppShell from "@/components/layout/AppShell";
import { ADMIN_ROUTE } from "@/components/layout/shellNavigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

function GateState({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-[var(--ds-bg-app)] px-5 text-center">
      <div className="agentify-card w-full max-w-md p-7">
        <p className="agentify-label">{eyebrow}</p>
        <h1 className="mt-3 text-2xl font-semibold text-[color:var(--ds-text-primary)]">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--ds-text-muted)]">
          {detail}
        </p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
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
      <GateState
        eyebrow="Preparing workspace"
        title="Opening AgentifyAI..."
        detail="Checking your secure session before showing private study content."
      />
    );
  }

  if (authError) {
    return (
      <GateState
        eyebrow="Sign-in setup"
        title="AgentifyAI sign-in needs configuration."
        detail={authError}
        action={(
          <Link
            href="/login"
            className="agentify-action agentify-action-primary inline-flex px-5 py-3 text-sm font-semibold"
          >
            Return to sign in
          </Link>
        )}
      />
    );
  }

  if (sessionExpired) {
    return (
      <GateState
        eyebrow="Session ended"
        title="Please sign in again."
        detail="Your previous session expired, so private study content stays hidden until you reconnect."
        action={(
          <Link
            href="/login"
            className="agentify-action agentify-action-primary inline-flex px-5 py-3 text-sm font-semibold"
          >
            Open sign in
          </Link>
        )}
      />
    );
  }

  if (!user) return null;

  if (profileError || !accountProfile) {
    return (
      <GateState
        eyebrow="Profile connection"
        title="We could not prepare your account."
        detail="Your login is safe. Retry the profile connection to continue."
        action={(
          <button
            type="button"
            onClick={() => void refreshProfile()}
            className="agentify-action agentify-action-primary px-5 py-3 text-sm font-semibold"
          >
            Retry connection
          </button>
        )}
      />
    );
  }

  if (!accountProfile.onboarding_completed) return null;

  if (isAdminRoute) {
    return <div className="min-h-[100svh] bg-[#050812]">{children}</div>;
  }

  return (
    <AppShell displayName={displayName} isAdmin={isAdmin} onLogout={logout}>
      {children}
    </AppShell>
  );
}
