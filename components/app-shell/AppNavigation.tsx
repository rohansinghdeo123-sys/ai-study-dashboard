"use client";

import { AppIcon } from "@/components/ui/Polished";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  APP_NAVIGATION_ITEMS,
  isNavigationItemActive,
  type AppNavigationItem,
} from "@/components/app-shell/navigation";

function NavigationLink({
  item,
  compact = false,
  onVisit,
}: {
  item: AppNavigationItem;
  compact?: boolean;
  onVisit?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = isNavigationItemActive(item, pathname, searchParams);

  return (
    <Link
      href={item.href}
      className="market-nav-link"
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      onClick={onVisit}
    >
      <span className="market-nav-icon" aria-hidden="true">
        <AppIcon name={item.icon} />
      </span>
      <span>{compact ? item.shortLabel : item.label}</span>
    </Link>
  );
}

export default function AppNavigation() {
  const primary = APP_NAVIGATION_ITEMS.filter((item) => item.group === "primary");
  const insights = APP_NAVIGATION_ITEMS.filter((item) => item.group === "insights");

  return (
    <>
      <aside className="market-desktop-navigation" aria-label="AgentifyAI navigation">
        <nav className="market-navigation-group" aria-label="Learning modes">
          {primary.map((item) => <NavigationLink key={item.id} item={item} />)}
        </nav>
        <nav className="market-navigation-group market-navigation-insights" aria-label="Insights">
          <span className="market-navigation-label">Insights</span>
          {insights.map((item) => <NavigationLink key={item.id} item={item} />)}
        </nav>
      </aside>

      <nav className="market-mobile-navigation" aria-label="AgentifyAI mobile navigation">
        {primary.map((item) => <NavigationLink key={item.id} item={item} compact />)}
        <details className="market-mobile-more">
          <summary aria-label="More destinations">
            <span className="market-nav-icon" aria-hidden="true">
              <AppIcon name="spark" />
            </span>
            <span>More</span>
          </summary>
          <div className="market-mobile-more-menu">
            {insights.map((item) => (
              <NavigationLink
                key={item.id}
                item={item}
                onVisit={() => {
                  document.querySelector<HTMLDetailsElement>(".market-mobile-more")?.removeAttribute("open");
                }}
              />
            ))}
          </div>
        </details>
      </nav>
    </>
  );
}
