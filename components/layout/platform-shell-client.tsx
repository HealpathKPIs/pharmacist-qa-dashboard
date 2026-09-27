"use client";

import {
  BookOpen,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Target,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { logout } from "@/app/auth-actions";
import { ThemeSwitch, ThemeToggleButton } from "@/components/theme/theme-switch";
import {
  AUDIT_MODULES,
  CLINICAL_KPI_PATH,
  getAuditPath,
  type AuditType,
} from "@/lib/audit-types";
import {
  getEffectiveModules,
  getModuleLabels,
  getProfileHomePath,
  isPrimaryAdmin,
  ROLE_LABELS,
  type UserProfile,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";

type NavigationItem = {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  // Shown indented under the module it belongs to.
  nested?: boolean;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({
  item,
  pathname,
}: {
  item: NavigationItem;
  pathname: string;
}) {
  const Icon = item.icon;
  const isActive = isActivePath(pathname, item.href);

  return (
    <Link
      className={cn(
        "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-fg-muted transition-colors hover:bg-tint/10 hover:text-fg-strong",
        item.nested && "ml-5",
        isActive && "bg-tint/10 text-fg-strong",
      )}
      href={item.href}
    >
      <Icon
        aria-hidden="true"
        className={cn("h-4 w-4", isActive && "text-brand")}
      />
      {item.label}
    </Link>
  );
}

export function PlatformShellClient({
  auditType,
  children,
  profile,
}: {
  auditType?: AuditType;
  children: React.ReactNode;
  profile: UserProfile;
}) {
  const pathname = usePathname();
  const visibleModules = getEffectiveModules(profile).map(
    (auditType) => AUDIT_MODULES[auditType],
  );
  const moduleItems: NavigationItem[] = visibleModules.flatMap((module) => [
    {
      href: getAuditPath(module.auditType),
      icon: profile.role === "admin" ? ShieldCheck : LayoutDashboard,
      label: module.moduleLabel,
    },
    // Only users who can open Clinical QA see its KPI page.
    ...(module.auditType === "clinical"
      ? [{ href: CLINICAL_KPI_PATH, icon: Target, label: "Clinical KPIs", nested: true }]
      : []),
  ]);
  const primaryItems: NavigationItem[] =
    profile.role === "admin"
      ? [
          { href: "/executive", icon: LayoutDashboard, label: "Executive Dashboard" },
          ...moduleItems,
          { href: "/issue-dictionary", icon: BookOpen, label: "Issue Dictionary" },
          { href: "/settings", icon: Settings, label: "Settings" },
          ...(isPrimaryAdmin(profile)
            ? [
                {
                  href: "/settings/users",
                  icon: Users,
                  label: "Users Management",
                },
              ]
            : []),
        ]
      : moduleItems;
  const operationsItems: NavigationItem[] =
    profile.role === "admin" && auditType
      ? [
          {
            href: getAuditPath(auditType, "/upload"),
            icon: Upload,
            label: "Upload",
          },
          {
            href: getAuditPath(auditType, "/uploads"),
            icon: History,
            label: "Upload History",
          },
        ]
      : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-tint/10 bg-panel px-4 py-5 lg:flex lg:flex-col">
        <Link
          className="flex items-center gap-3 text-sm font-semibold text-fg-strong"
          href={getProfileHomePath(profile)}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-brand/25 bg-brand/10 text-brand-strong">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          </span>
          QA Platform
        </Link>

        <nav className="mt-6 space-y-1" aria-label="Platform navigation">
          {primaryItems.map((item) => (
            <NavigationLink item={item} key={item.href} pathname={pathname} />
          ))}
        </nav>

        {operationsItems.length > 0 ? (
          <div className="mt-6 border-t border-tint/10 pt-5">
            <p className="px-3 text-xs font-medium uppercase tracking-wide text-fg-faint">
              {AUDIT_MODULES[auditType!].moduleLabel} operations
            </p>
            <nav className="mt-2 space-y-1" aria-label="Admin operations">
              {operationsItems.map((item) => (
                <NavigationLink item={item} key={item.href} pathname={pathname} />
              ))}
            </nav>
          </div>
        ) : null}

        <div className="mt-auto space-y-3 border-t border-tint/10 pt-4">
          <div className="px-3">
            <p className="truncate text-sm font-medium text-fg-strong">{profile.fullName}</p>
            <p className="truncate text-xs text-fg-subtle">{profile.email}</p>
            <p className="mt-1 text-xs text-brand">
              {ROLE_LABELS[profile.role]} · {getModuleLabels(profile)}
            </p>
          </div>
          <ThemeSwitch />
          <form action={logout}>
            <button
              className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-fg-muted transition-colors hover:bg-tint/10 hover:text-fg-strong"
              type="submit"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="border-b border-tint/10 bg-panel px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-fg-strong">QA Platform</p>
          <div className="flex items-center gap-1">
            <ThemeToggleButton />
            <form action={logout}>
              <button
                aria-label="Sign out"
                className="rounded-md p-2 text-fg-muted hover:bg-tint/10 hover:text-fg-strong"
                type="submit"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
        <nav
          aria-label="Mobile navigation"
          className="mt-3 flex items-center gap-2 overflow-x-auto"
        >
          {[...primaryItems, ...operationsItems].map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-fg-muted",
                  isActive && "bg-tint/10 text-fg-strong",
                )}
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="lg:pl-72">{children}</div>
    </div>
  );
}
