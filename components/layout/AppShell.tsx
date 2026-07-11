"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import BackendStatus from "@/components/BackendStatus";
import ChatThinkingLogo from "@/components/brand/ChatThinkingLogo";
import ThemeToggle from "@/components/ThemeToggle";
import { AppIcon } from "@/components/ui/Polished";
import { cn } from "@/lib/utils";
import {
  getShellPageMeta,
  getVisibleShellNavItems,
  isShellRouteActive,
} from "@/components/layout/shellNavigation";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type AppShellProps = {
  children: ReactNode;
  displayName: string;
  isAdmin: boolean;
  onLogout: () => void | Promise<void>;
};

export default function AppShell({
  children,
  displayName,
  isAdmin,
  onLogout,
}: AppShellProps) {
  const pathname = usePathname();
  const page = getShellPageMeta(pathname);
  const navItems = getVisibleShellNavItems(isAdmin);
  const isImmersiveRoute = pathname?.startsWith("/dashboard/study") ?? false;
  const initials = getInitials(displayName);

  return (
    <div
      className={cn(
        "dashboard-shell app-shell relative min-h-[100svh] overflow-x-hidden text-[color:var(--ds-text-primary)]",
        isImmersiveRoute && "app-shell--immersive",
      )}
    >
      <a className="app-shell-skip" href="#app-shell-content">
        Skip to main content
      </a>
      <div className="dashboard-ambient app-shell-ambient pointer-events-none fixed inset-0" aria-hidden="true" />

      <aside className="app-shell-sidebar" aria-label="Primary navigation">
        <Link href="/dashboard" className="app-shell-brand" aria-label="AgentifyAI learning hub">
          <ChatThinkingLogo state="thinking" size={42} className="auth-brand-logo dashboard-brand-logo" label="AgentifyAI" />
          <span>
            <strong>AgentifyAI</strong>
            <small>Student workspace</small>
          </span>
        </Link>

        <nav className="app-shell-nav" aria-label="Workspace">
          {navItems.map((item) => {
            const active = isShellRouteActive(pathname, item);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="app-shell-nav-link"
                data-active={active ? "true" : "false"}
                aria-current={active ? "page" : undefined}
              >
                <span className="app-shell-nav-icon" aria-hidden="true">
                  <AppIcon name={item.icon} />
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="app-shell-sidebar-footer" aria-label="Active workspace">
          <span className="app-shell-avatar" aria-hidden="true">{initials}</span>
          <span>
            <strong>{displayName}</strong>
            <small>{isAdmin ? "Admin workspace" : "Student workspace"}</small>
          </span>
        </div>
      </aside>

      <header className="app-shell-topbar">
        <div className="app-shell-mobile-brand">
          <Link href="/dashboard" aria-label="AgentifyAI learning hub">
            <ChatThinkingLogo state="thinking" size={34} className="auth-brand-logo dashboard-brand-logo" label="AgentifyAI" />
            <span>AgentifyAI</span>
          </Link>
        </div>

        <div className="app-shell-page-context">
          <nav aria-label="Workspace breadcrumb" className="app-shell-breadcrumb">
            <Link href="/dashboard">Learning Hub</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{page.current}</span>
          </nav>
          <div>
            <p>{page.eyebrow}</p>
            <h1>{page.title}</h1>
            <span className="app-shell-page-description">{page.description}</span>
          </div>
        </div>

        <div className="app-shell-actions" aria-label="Workspace actions">
          <div className="app-shell-status" aria-label="System status">
            <BackendStatus />
          </div>
          {page.primaryAction ? (
            <Link href={page.primaryAction.href} className="app-shell-context-action">
              {page.primaryAction.label}
            </Link>
          ) : null}
          <ThemeToggle compact />
          <details className="app-shell-profile-menu">
            <summary aria-label={`Open profile menu for ${displayName}`}>
              <span className="app-shell-avatar" aria-hidden="true">{initials}</span>
              <span className="app-shell-profile-name">{displayName}</span>
            </summary>
            <div className="app-shell-profile-panel">
              <p>
                <strong>{displayName}</strong>
                <span>{isAdmin ? "Admin access" : "Student account"}</span>
              </p>
              <Link href="/dashboard/progress">Progress overview</Link>
              <button type="button" onClick={() => void onLogout()}>
                Log out
              </button>
            </div>
          </details>
        </div>
      </header>

      <main id="app-shell-content" className="app-shell-content" data-immersive={isImmersiveRoute ? "true" : "false"} tabIndex={-1}>
        {isImmersiveRoute ? children : <div className="app-shell-content-inner">{children}</div>}
      </main>

      <nav className="app-shell-mobile-nav" aria-label="Mobile primary navigation">
        <div className="app-shell-mobile-nav-track">
          {navItems.map((item) => {
            const active = isShellRouteActive(pathname, item);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="app-shell-mobile-nav-link"
                data-active={active ? "true" : "false"}
                aria-current={active ? "page" : undefined}
              >
                <AppIcon name={item.icon} />
                <span>{item.mobileLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
