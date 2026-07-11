import { describe, expect, it } from "vitest";
import {
  ADMIN_ROUTE,
  SHELL_NAV_ITEMS,
  getShellPageMeta,
  getVisibleShellNavItems,
  isShellRouteActive,
} from "@/components/layout/shellNavigation";

describe("authenticated app shell navigation", () => {
  it("keeps founder/admin navigation hidden from standard students", () => {
    const studentItems = getVisibleShellNavItems(false);
    const adminItems = getVisibleShellNavItems(true);

    expect(studentItems.some((item) => item.href === ADMIN_ROUTE)).toBe(false);
    expect(adminItems.some((item) => item.href === ADMIN_ROUTE)).toBe(true);
  });

  it("marks exact and nested routes active without overmatching the dashboard root", () => {
    const dashboard = SHELL_NAV_ITEMS.find((item) => item.href === "/dashboard")!;
    const study = SHELL_NAV_ITEMS.find((item) => item.href === "/dashboard/study")!;

    expect(isShellRouteActive("/dashboard", dashboard)).toBe(true);
    expect(isShellRouteActive("/dashboard/study", dashboard)).toBe(false);
    expect(isShellRouteActive("/dashboard/study/thread-123", study)).toBe(true);
  });

  it("treats the legacy analytics route as progress navigation", () => {
    const progress = SHELL_NAV_ITEMS.find((item) => item.href === "/dashboard/progress")!;

    expect(isShellRouteActive("/analytics", progress)).toBe(true);
    expect(isShellRouteActive("/analytics/deep-dive", progress)).toBe(true);
  });

  it("returns route metadata for key student workspaces", () => {
    expect(getShellPageMeta("/dashboard").title).toBe("Learning Hub");
    expect(getShellPageMeta("/dashboard/exam").primaryAction?.href).toBe("/dashboard/study");
    expect(getShellPageMeta("/dashboard/mission").current).toBe("Mission");
    expect(getShellPageMeta("/dashboard/internal/admin").title).toBe("Admin Console");
  });
});
