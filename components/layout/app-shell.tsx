"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Upload } from "lucide-react";

import { cn } from "@/lib/utils";

const navigationItems = [
  {
    href: "/",
    label: "Home",
    icon: LayoutDashboard,
  },
  {
    href: "/upload",
    label: "Upload",
    icon: Upload,
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#08090a] text-zinc-100">
      <div className="border-b border-white/10 bg-[#0d0f11]/95">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <Link className="text-sm font-semibold text-white" href="/">
            Pharmacist QA Dashboard
          </Link>
          <nav aria-label="Main navigation" className="flex gap-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

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
