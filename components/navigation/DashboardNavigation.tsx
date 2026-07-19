"use client";

import BackendStatus from "@/components/BackendStatus";
import ThemeToggle from "@/components/ThemeToggle";
import ChatThinkingLogo from "@/components/brand/ChatThinkingLogo";
import { AppIcon, type AppIconName } from "@/components/ui/Polished";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

const ADMIN_ROUTE = "/dashboard/internal/admin";

type NavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: AppIconName;
};

const PRIMARY_NAVIGATION: NavigationItem[] = [
  { href: "/dashboard", label: "Home", shortLabel: "Home", icon: "home" },
  { href: "/dashboard/study", label: "Study", shortLabel: "Study", icon: "study" },
  { href: "/dashboard/mission", label: "Mission", shortLabel: "Mission", icon: "mission" },
  { href: "/dashboard/exam", label: "Exam", shortLabel: "Exam", icon: "book" },
  { href: "/dashboard/progress", label: "Progress", shortLabel: "Progress", icon: "analytics" },
];

type DashboardNavigationProps = {
  children: ReactNode;
  displayName: string;
  email?: string | null;
  isAdmin: boolean;
  isStudyRoute: boolean;
  onLogout: () => void;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function routeIsActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ compact = false, tabletRail = false }: { compact?: boolean; tabletRail?: boolean }) {
  return (
    <Link
      href="/dashboard"
      aria-label="AgentifyAI home"
      className={cn(
        "group flex min-w-0 items-center rounded-2xl transition-opacity hover:opacity-80",
        compact
          ? "justify-center"
          : tabletRail
            ? "justify-center xl:justify-start xl:gap-3"
            : "gap-3",
      )}
    >
      <ChatThinkingLogo
        state="thinking"
        size={compact ? 38 : 42}
        className="shrink-0"
        label=""
      />
      <span
        className={cn(
          "min-w-0",
          compact ? "sr-only" : tabletRail && "hidden xl:block",
        )}
      >
        <span className="block truncate text-[15px] font-extrabold leading-none tracking-[-0.035em] text-[var(--agentify-primary-text)]">
          Agentify<span className="text-[#0E7490]">AI</span>
        </span>
        <span className="mt-1.5 block truncate text-[10px] font-semibold tracking-wide text-[var(--agentify-muted-text)]">
          Personal study agent
        </span>
      </span>
    </Link>
  );
}

function DesktopNavigationLink({
  item,
  active,
  compact,
}: {
  item: NavigationItem;
  active: boolean;
  compact: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex min-h-11 items-center rounded-xl text-sm font-semibold transition-all duration-200",
        compact
          ? "justify-center px-2"
          : "justify-center px-2 xl:justify-start xl:gap-3 xl:px-3.5",
        active
          ? "bg-[var(--agentify-active-bg)] text-[var(--agentify-primary-text)] shadow-[inset_0_0_0_1px_rgba(14,116,144,0.12)]"
          : "text-[var(--agentify-muted-text)] hover:bg-[var(--agentify-hover-bg)] hover:text-[var(--agentify-primary-text)]",
      )}
    >
      {active ? (
        <span
          className={cn(
            "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[#14B8A6]",
            compact && "left-1",
          )}
          aria-hidden="true"
        />
      ) : null}
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          active
            ? "bg-[#0E7490] text-white shadow-[0_8px_20px_rgba(14,116,144,0.22)]"
            : "text-[var(--agentify-muted-text)] group-hover:text-[#0E7490]",
        )}
        aria-hidden="true"
      >
        <AppIcon name={item.icon} className="h-[18px] w-[18px]" />
      </span>
      <span className={cn("truncate", compact ? "sr-only" : "sr-only xl:not-sr-only")}>{item.label}</span>
    </Link>
  );
}

function MobileNavigationLink({ item, active }: { item: NavigationItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-bold transition-colors",
        active
          ? "text-[#0E7490]"
          : "text-[var(--agentify-muted-text)] hover:text-[var(--agentify-primary-text)]",
      )}
    >
      {active ? (
        <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-[#14B8A6]" aria-hidden="true" />
      ) : null}
      <span
        className={cn(
          "flex h-7 w-9 items-center justify-center rounded-lg",
          active && "bg-[var(--agentify-active-bg)]",
        )}
        aria-hidden="true"
      >
        <AppIcon name={item.icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="max-w-full truncate">{item.shortLabel}</span>
    </Link>
  );
}

export default function DashboardNavigation({
  children,
  displayName,
  email,
  isAdmin,
  isStudyRoute,
  onLogout,
}: DashboardNavigationProps) {
  const pathname = usePathname() || "/dashboard";
  const [compact, setCompact] = useState(false);
  const initials = getInitials(displayName) || "ST";

  return (
    <div className="relative min-h-[100svh] w-full">
      <aside
        aria-label="Dashboard sidebar"
        data-compact={compact ? "true" : "false"}
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[color:var(--agentify-border)] bg-[var(--agentify-card-bg)] shadow-[14px_0_45px_rgba(15,23,42,0.055)] backdrop-blur-2xl transition-[width] duration-200 md:flex",
          compact ? "w-[84px]" : "w-[84px] xl:w-[264px]",
        )}
      >
        <div
          className={cn(
            "flex h-20 shrink-0 items-center",
            compact ? "justify-center px-3" : "justify-center px-3 xl:justify-start xl:px-5",
          )}
        >
          <Brand compact={compact} tabletRail />
        </div>

        <button
          type="button"
          onClick={() => setCompact((current) => !current)}
          aria-label={compact ? "Expand dashboard sidebar" : "Collapse dashboard sidebar"}
          aria-pressed={compact}
          title={compact ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3.5 top-6 hidden h-7 w-7 items-center justify-center rounded-full border border-[color:var(--agentify-border)] bg-[var(--agentify-card-bg)] text-[var(--agentify-muted-text)] shadow-[0_8px_22px_rgba(15,23,42,0.12)] transition hover:scale-105 hover:text-[#0E7490] xl:flex"
        >
          <AppIcon
            name="panelLeft"
            className={cn("h-3.5 w-3.5 transition-transform", compact && "rotate-180")}
          />
        </button>

        <nav aria-label="Primary navigation" className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 pb-3">
          <p
            className={cn(
              "mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--agentify-muted-text)]",
              compact ? "sr-only" : "sr-only xl:not-sr-only",
            )}
          >
            Workspace
          </p>
          <div className="space-y-1">
            {PRIMARY_NAVIGATION.map((item) => (
              <DesktopNavigationLink
                key={item.href}
                item={item}
                active={routeIsActive(pathname, item.href)}
                compact={compact}
              />
            ))}
          </div>

          {isAdmin ? (
            <div className="mt-3 border-t border-[color:var(--agentify-border)] pt-3">
              <DesktopNavigationLink
                item={{ href: ADMIN_ROUTE, label: "Admin console", shortLabel: "Admin", icon: "dashboard" }}
                active={routeIsActive(pathname, ADMIN_ROUTE)}
                compact={compact}
              />
            </div>
          ) : null}

          <div className="mt-auto space-y-2 pt-4">
            <div
              className={cn(
                "overflow-hidden [&_.backend-status]:w-full [&_.backend-status]:justify-center",
                compact && "[&_.backend-status]:px-2",
              )}
            >
              <BackendStatus />
            </div>

            <div className="overflow-hidden [&_[data-theme-toggle]]:w-full [&_[data-theme-toggle]]:min-w-0 [&_[data-theme-toggle]]:justify-center [&_[data-theme-toggle]]:rounded-xl [&_[data-theme-toggle]]:border [&_[data-theme-toggle]]:border-[color:var(--agentify-border)] [&_[data-theme-toggle]]:bg-transparent [&_[data-theme-toggle]]:text-[11px] [&_[data-theme-toggle]]:font-semibold [&_[data-theme-toggle]]:text-[var(--agentify-muted-text)]">
              <ThemeToggle compact />
            </div>

            <div
              className={cn(
                "flex items-center rounded-xl border border-[color:var(--agentify-border)] bg-[var(--agentify-hover-bg)]/40 p-2",
                compact ? "justify-center" : "justify-center xl:gap-2.5",
              )}
              title={displayName}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0E7490] text-xs font-extrabold text-white shadow-[0_8px_22px_rgba(14,116,144,0.2)]">
                {initials}
              </span>
              <span className={cn("min-w-0", compact ? "sr-only" : "sr-only xl:not-sr-only")}>
                <span className="block truncate text-xs font-bold text-[var(--agentify-primary-text)]">{displayName}</span>
                <span className="mt-0.5 block truncate text-[10px] text-[var(--agentify-muted-text)]">
                  {isAdmin ? "Administrator" : "Student account"}
                </span>
              </span>
            </div>

            <button
              type="button"
              onClick={onLogout}
              title="Log out"
              className={cn(
                "flex min-h-10 w-full items-center rounded-xl text-xs font-semibold text-[var(--agentify-muted-text)] transition hover:bg-rose-500/10 hover:text-rose-500",
                compact
                  ? "justify-center px-2"
                  : "justify-center px-2 xl:justify-start xl:gap-3 xl:px-3.5",
              )}
            >
              <AppIcon name="arrowRight" className="h-4 w-4 rotate-180" />
              <span className={compact ? "sr-only" : "sr-only xl:not-sr-only"}>Log out</span>
            </button>
          </div>
        </nav>
      </aside>

      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-[color:var(--agentify-border)] bg-[var(--agentify-card-bg)]/95 px-3 shadow-[0_10px_32px_rgba(15,23,42,0.07)] backdrop-blur-2xl md:hidden">
        <Brand />

        <details key={pathname} className="group relative ml-3 shrink-0">
          <summary
            aria-label="Open account menu"
            className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-[color:var(--agentify-border)] bg-[var(--agentify-hover-bg)] text-xs font-extrabold text-[#0E7490] transition hover:border-[#0E7490]/35 [&::-webkit-details-marker]:hidden"
          >
            {initials}
          </summary>
          <div className="absolute right-0 top-12 w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl border border-[color:var(--agentify-border)] bg-[var(--agentify-card-bg)] p-3 shadow-[0_24px_70px_rgba(15,23,42,0.2)] backdrop-blur-2xl">
            <div className="flex items-center gap-3 border-b border-[color:var(--agentify-border)] px-1 pb-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0E7490] text-xs font-extrabold text-white">
                {initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[var(--agentify-primary-text)]">{displayName}</span>
                <span className="mt-0.5 block truncate text-[11px] text-[var(--agentify-muted-text)]">
                  {email || (isAdmin ? "Administrator" : "Student account")}
                </span>
              </span>
            </div>

            <div className="mt-3 overflow-hidden [&_[data-theme-toggle]]:w-full [&_[data-theme-toggle]]:justify-center [&_[data-theme-toggle]]:rounded-xl [&_[data-theme-toggle]]:border [&_[data-theme-toggle]]:border-[color:var(--agentify-border)] [&_[data-theme-toggle]]:bg-transparent [&_[data-theme-toggle]]:text-xs [&_[data-theme-toggle]]:font-semibold [&_[data-theme-toggle]]:text-[var(--agentify-muted-text)]">
              <ThemeToggle compact />
            </div>

            {isAdmin ? (
              <Link
                href={ADMIN_ROUTE}
                className="mt-2 flex min-h-10 items-center gap-3 rounded-xl px-3 text-xs font-semibold text-[var(--agentify-muted-text)] transition hover:bg-[var(--agentify-hover-bg)] hover:text-[var(--agentify-primary-text)]"
              >
                <AppIcon name="dashboard" className="h-4 w-4" />
                Admin console
              </Link>
            ) : null}

            <button
              type="button"
              onClick={onLogout}
              className="mt-2 flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-xs font-semibold text-[var(--agentify-muted-text)] transition hover:bg-rose-500/10 hover:text-rose-500"
            >
              <AppIcon name="arrowRight" className="h-4 w-4 rotate-180" />
              Log out
            </button>
          </div>
        </details>
      </header>

      <nav
        aria-label="Mobile primary navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[color:var(--agentify-border)] bg-[var(--agentify-card-bg)]/95 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-12px_34px_rgba(15,23,42,0.09)] backdrop-blur-2xl md:hidden"
      >
        <div className="mx-auto flex h-[64px] max-w-lg items-stretch">
          {PRIMARY_NAVIGATION.map((item) => (
            <MobileNavigationLink
              key={item.href}
              item={item}
              active={routeIsActive(pathname, item.href)}
            />
          ))}
        </div>
      </nav>

      <main
        id="main-content"
        className={cn(
          "relative z-10 box-border min-w-0 transition-[padding-left] duration-200",
          compact ? "md:pl-[84px]" : "md:pl-[84px] xl:pl-[264px]",
          isStudyRoute
            ? "h-[calc(100svh-5rem-env(safe-area-inset-bottom))] overflow-hidden md:h-[100svh]"
            : "min-h-[100svh]",
        )}
      >
        <div
          className={
            isStudyRoute
              ? "h-full min-h-0 w-full overflow-hidden [&&>.study-lab-shell]:!h-full"
              : "min-h-[100svh] w-full px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-20 sm:px-5 md:px-6 md:pb-8 md:pt-6 lg:px-8"
          }
        >
          {children}
        </div>
      </main>
    </div>
  );
}
