"use client";

import ChatThinkingLogo from "@/components/brand/ChatThinkingLogo";
import AppNavigation from "@/components/app-shell/AppNavigation";
import UserMenu from "@/components/app-shell/UserMenu";
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
  const immersive = pathname.startsWith("/dashboard/study")
    || pathname.startsWith("/dashboard/revision")
    || pathname.startsWith("/dashboard/exam");

  return (
    <div className="dashboard-shell market-ready-shell">
      <div className="market-shell-ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <header className="market-shell-topbar">
        <Link href="/dashboard" className="market-shell-brand" aria-label="AgentifyAI Workspace">
          <ChatThinkingLogo state="idle" size={38} className="market-shell-logo" label="" />
          <span>
            <strong>Agentify<span>AI</span></strong>
            <small>Learning workspace</small>
          </span>
        </Link>

        <UserMenu
          displayName={displayName}
          classLevel={classLevel}
          isAdmin={isAdmin}
          onLogout={onLogout}
        />
      </header>

      <AppNavigation />

      <main
        id="main-content"
        className={`market-shell-main${immersive ? " is-immersive" : ""}`}
      >
        {children}
      </main>
    </div>
  );
}
