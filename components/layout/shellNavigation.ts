import type { AppIconName } from "@/components/ui/Polished";

export const ADMIN_ROUTE = "/dashboard/internal/admin";

export type ShellNavItem = {
  label: string;
  mobileLabel: string;
  href: string;
  icon: AppIconName;
  description: string;
  adminOnly?: boolean;
  aliases?: string[];
};

export type ShellPageMeta = {
  title: string;
  eyebrow: string;
  description: string;
  current: string;
  primaryAction?: {
    label: string;
    href: string;
  };
};

export const SHELL_NAV_ITEMS: readonly ShellNavItem[] = [
  {
    label: "Learning Hub",
    mobileLabel: "Hub",
    href: "/dashboard",
    icon: "dashboard",
    description: "Daily plan and weekly challenge",
  },
  {
    label: "Study Lab",
    mobileLabel: "Study",
    href: "/dashboard/study",
    icon: "study",
    description: "Personal AI tutor",
  },
  {
    label: "Exam Mode",
    mobileLabel: "Exam",
    href: "/dashboard/exam",
    icon: "book",
    description: "Practice and evaluation",
  },
  {
    label: "Mission",
    mobileLabel: "Mission",
    href: "/dashboard/mission",
    icon: "mission",
    description: "Guided autonomous study",
  },
  {
    label: "Progress",
    mobileLabel: "Progress",
    href: "/dashboard/progress",
    icon: "analytics",
    description: "Analytics and mastery",
    aliases: ["/analytics"],
  },
  {
    label: "Admin",
    mobileLabel: "Admin",
    href: ADMIN_ROUTE,
    icon: "dashboard",
    description: "Founder console",
    adminOnly: true,
  },
];

export function getVisibleShellNavItems(isAdmin: boolean) {
  return SHELL_NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
}

export function isShellRouteActive(pathname: string | null | undefined, item: ShellNavItem) {
  if (!pathname) return false;
  if (pathname === item.href) return true;
  if (item.aliases?.some((alias) => pathname === alias || pathname.startsWith(`${alias}/`))) {
    return true;
  }
  return item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`);
}

export function getShellPageMeta(pathname: string | null | undefined): ShellPageMeta {
  if (pathname?.startsWith("/dashboard/study")) {
    return {
      title: "Study Lab",
      eyebrow: "Tutor workspace",
      description: "Ask doubts, keep context, and build revision tools.",
      current: "Study Lab",
      primaryAction: { label: "Exam Mode", href: "/dashboard/exam" },
    };
  }

  if (pathname?.startsWith("/dashboard/exam")) {
    return {
      title: "Exam Mode",
      eyebrow: "Assessment workspace",
      description: "Practice, upload papers, evaluate writing, and review mistakes.",
      current: "Exam Mode",
      primaryAction: { label: "Study topic", href: "/dashboard/study" },
    };
  }

  if (pathname?.startsWith("/dashboard/mission")) {
    return {
      title: "Autonomous Mission",
      eyebrow: "Guided study path",
      description: "Plan, diagnose, explain, and practice one focused topic.",
      current: "Mission",
      primaryAction: { label: "Open Study Lab", href: "/dashboard/study" },
    };
  }

  if (pathname?.startsWith("/dashboard/progress") || pathname?.startsWith("/analytics")) {
    return {
      title: "Progress",
      eyebrow: "Learning analytics",
      description: "Track mastery, momentum, weak topics, and recent sessions.",
      current: "Progress",
      primaryAction: { label: "Start exam", href: "/dashboard/exam" },
    };
  }

  if (pathname?.startsWith(ADMIN_ROUTE)) {
    return {
      title: "Admin Console",
      eyebrow: "Internal operations",
      description: "Founder-only operational visibility.",
      current: "Admin",
    };
  }

  return {
    title: "Learning Hub",
    eyebrow: "Student workspace",
    description: "Your next action, rival challenge, and recent work in one place.",
    current: "Dashboard",
    primaryAction: { label: "Ask a doubt", href: "/dashboard/study" },
  };
}
