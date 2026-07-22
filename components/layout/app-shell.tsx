"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, LayoutDashboard, Settings, Upload } from "lucide-react";

import {
  AUDIT_MODULES,
  getAuditModule,
  getAuditPath,
  type AuditType,
} from "@/lib/audit-types";
import { cn } from "@/lib/utils";

export function AppShell({
  auditType = "clinical",
  children,
}: {
  auditType?: AuditType;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const moduleConfig = getAuditModule(auditType);
  const navigationItems = [
    { href: getAuditPath(auditType), label: "Dashboard", icon: LayoutDashboard },
    { href: getAuditPath(auditType, "/upload"), label: "Upload", icon: Upload },
    { href: getAuditPath(auditType, "/uploads"), label: "History", icon: History },
    { href: getAuditPath(auditType, "/settings"), label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#08090a] text-zinc-100">
      <div className="border-b border-white/10 bg-[#0d0f11]/95">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Link className="text-sm font-semibold text-white" href={getAuditPath(auditType)}>
              {moduleConfig.dashboardTitle}
            </Link>
            <nav aria-label="QA products" className="flex flex-wrap gap-2">
              {Object.values(AUDIT_MODULES).map((item) => (
                <Link
                  className={cn(
                    "rounded-md border border-white/10 px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/10 hover:text-white",
                    item.auditType === auditType && "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
                  )}
                  href={getAuditPath(item.auditType)}
                  key={item.auditType}
                >
                  {item.moduleLabel}
                </Link>
              ))}
            </nav>
          </div>
          <nav aria-label={`${moduleConfig.moduleLabel} navigation`} className="flex flex-wrap gap-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.label === "Dashboard"
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/10 hover:text-white",
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
      </div>
      {children}
    </div>
  );
}
