"use client";

import UserMenu from "@/components/app-shell/UserMenu";
import { AppIcon } from "@/components/ui/Polished";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function AppShell({
  children,
  displayName,
  classLevel,
  isAdmin,
  onLogout,
}: {
  children: ReactNode;
  displayName: string;
  classLevel: string;
  isAdmin: boolean;
  onLogout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const isLanding = pathname === "/dashboard" || pathname === "/dashboard/";
  const immersive = pathname.startsWith("/dashboard/study")
    || pathname.startsWith("/dashboard/revision")
    || pathname.startsWith("/dashboard/exam");

  return (
    <div className="dashboard-shell market-ready-shell">
      {!isLanding ? (
        <div className="market-floating-controls">
          <Link
            href="/dashboard"
            className="market-floating-home"
            aria-label="Return to Workspace"
            title="Workspace"
          >
            <AppIcon name="home" />
            <span className="sr-only">Workspace</span>
          </Link>
          <UserMenu
            compact
            displayName={displayName}
            classLevel={classLevel}
            isAdmin={isAdmin}
            onLogout={onLogout}
          />
        </div>
      ) : null}

      <main
        id="main-content"
        className={[
          "market-shell-main",
          isLanding ? "is-landing" : "is-route",
          immersive ? "is-immersive" : "",
        ].filter(Boolean).join(" ")}
      >
        {children}
      </main>
    </div>
  );
}
