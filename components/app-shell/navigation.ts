import type { AppIconName } from "@/components/ui/Polished";

export type AppNavigationId =
  | "workspace"
  | "planning"
  | "study"
  | "revision"
  | "exam"
  | "analytics"
  | "rankings";

export type AppNavigationItem = {
  id: AppNavigationId;
  label: string;
  shortLabel: string;
  href: string;
  icon: AppIconName;
  group: "primary" | "insights";
};

export const APP_NAVIGATION_ITEMS: AppNavigationItem[] = [
  {
    id: "workspace",
    label: "Workspace",
    shortLabel: "Home",
    href: "/dashboard",
    icon: "dashboard",
    group: "primary",
  },
  {
    id: "planning",
    label: "Planning",
    shortLabel: "Plan",
    href: "/dashboard/planning",
    icon: "mission",
    group: "primary",
  },
  {
    id: "study",
    label: "Study",
    shortLabel: "Study",
    href: "/dashboard/study",
    icon: "study",
    group: "primary",
  },
  {
    id: "revision",
    label: "Revision",
    shortLabel: "Revise",
    href: "/dashboard/revision",
    icon: "book",
    group: "primary",
  },
  {
    id: "exam",
    label: "Exam",
    shortLabel: "Exam",
    href: "/dashboard/exam",
    icon: "check",
    group: "primary",
  },
  {
    id: "analytics",
    label: "Analytics",
    shortLabel: "Analytics",
    href: "/dashboard/analytics",
    icon: "analytics",
    group: "insights",
  },
  {
    id: "rankings",
    label: "Rankings",
    shortLabel: "Rankings",
    href: "/dashboard/rankings",
    icon: "spark",
    group: "insights",
  },
];

export function isNavigationItemActive(
  item: AppNavigationItem,
  pathname: string,
  searchParams: Pick<URLSearchParams, "get">,
) {
  const mode = searchParams.get("mode");
  const view = searchParams.get("view");

  if (item.id === "workspace") return pathname === "/dashboard";
  if (item.id === "planning") {
    return pathname.startsWith("/dashboard/mission") || pathname.startsWith("/dashboard/planning");
  }
  if (item.id === "study") {
    return pathname.startsWith("/dashboard/study") && mode !== "revision";
  }
  if (item.id === "revision") {
    return pathname.startsWith("/dashboard/revision")
      || (pathname.startsWith("/dashboard/study") && mode === "revision");
  }
  if (item.id === "exam") return pathname.startsWith("/dashboard/exam");
  if (item.id === "analytics") {
    return pathname.startsWith("/dashboard/analytics")
      || (pathname.startsWith("/dashboard/progress") && view !== "rankings")
      || pathname === "/analytics";
  }
  return pathname.startsWith("/dashboard/rankings")
    || (pathname.startsWith("/dashboard/progress") && view === "rankings");
}
