"use client";

import {
  BookOpen,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { logout } from "@/app/auth-actions";
import {
  AUDIT_MODULES,
  getAuditPath,
  type AuditType,
} from "@/lib/audit-types";
import {
  getModuleLabelForRole,
  ROLE_LABELS,
  ROLE_MODULES,
  type UserProfile,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";

type NavigationItem = {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
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
        "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/10 hover:text-white",
        isActive && "bg-white/10 text-white",
      )}
      href={item.href}
    >
      <Icon
        aria-hidden="true"
        className={cn("h-4 w-4", isActive && "text-emerald-300")}
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
  const managerModule = ROLE_MODULES[profile.role];
  const visibleModules = managerModule
    ? [AUDIT_MODULES[managerModule]]
    : Object.values(AUDIT_MODULES);
  const primaryItems: NavigationItem[] =
    profile.role === "admin"
      ? [
          { href: "/executive", icon: LayoutDashboard, label: "Executive Dashboard" },
          ...visibleModules.map((module) => ({
            href: getAuditPath(module.auditType),
            icon: ShieldCheck,
            label: module.moduleLabel,
          })),
          { href: "/users", icon: Users, label: "Users" },
          { href: "/issue-dictionary", icon: BookOpen, label: "Issue Dictionary" },
          { href: "/settings", icon: Settings, label: "Settings" },
        ]
      : visibleModules.map((module) => ({
          href: getAuditPath(module.auditType),
          icon: LayoutDashboard,
          label: module.moduleLabel,
        }));
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
    <div className="min-h-screen bg-[#08090a] text-zinc-100">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-white/10 bg-[#0b0d0f] px-4 py-5 lg:flex lg:flex-col">
        <Link
          className="flex items-center gap-3 text-sm font-semibold text-white"
          href={profile.role === "admin" ? "/executive" : primaryItems[0].href}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
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
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="px-3 text-xs font-medium uppercase tracking-wide text-zinc-600">
              {AUDIT_MODULES[auditType!].moduleLabel} operations
            </p>
            <nav className="mt-2 space-y-1" aria-label="Admin operations">
              {operationsItems.map((item) => (
                <NavigationLink item={item} key={item.href} pathname={pathname} />
              ))}
            </nav>
          </div>
        ) : null}

        <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
          <div className="px-3">
            <p className="truncate text-sm font-medium text-white">{profile.fullName}</p>
            <p className="truncate text-xs text-zinc-500">{profile.email}</p>
            <p className="mt-1 text-xs text-emerald-300">
              {ROLE_LABELS[profile.role]} · {getModuleLabelForRole(profile.role)}
            </p>
          </div>
          <form action={logout}>
            <button
              className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              type="submit"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="border-b border-white/10 bg-[#0b0d0f] px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">QA Platform</p>
          <form action={logout}>
            <button
              aria-label="Sign out"
              className="rounded-md p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
              type="submit"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
            </button>
          </form>
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
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-zinc-400",
                  isActive && "bg-white/10 text-white",
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
