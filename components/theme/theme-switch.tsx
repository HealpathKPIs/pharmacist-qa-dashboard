"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import { THEME_LABELS, THEMES, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const THEME_ICONS: Record<Theme, typeof Sun> = {
  dark: Moon,
  light: Sun,
};

// Compact Light / Dark switch for the sidebar, available to every role.
export function ThemeSwitch({ className }: { className?: string }) {
  const { setTheme, theme } = useTheme();

  return (
    <div
      aria-label="Theme"
      className={cn(
        "grid grid-cols-2 gap-1 rounded-md border border-tint/10 bg-inset p-1",
        className,
      )}
      role="group"
    >
      {THEMES.map((option) => {
        const Icon = THEME_ICONS[option];
        const isActive = theme === option;

        return (
          <button
            aria-pressed={isActive}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-2 rounded text-xs font-medium text-fg-muted transition-colors hover:text-fg-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              isActive && "bg-tint/10 text-fg-strong",
            )}
            key={option}
            onClick={() => setTheme(option)}
            type="button"
          >
            <Icon aria-hidden="true" className={cn("h-3.5 w-3.5", isActive && "text-brand")} />
            {THEME_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}

// Icon-only switch for the mobile top bar.
export function ThemeToggleButton({ className }: { className?: string }) {
  const { setTheme, theme } = useTheme();
  const nextTheme: Theme = theme === "dark" ? "light" : "dark";
  const Icon = THEME_ICONS[nextTheme];
  const label = `Switch to ${THEME_LABELS[nextTheme].toLowerCase()} theme`;

  return (
    <button
      aria-label={label}
      className={cn(
        "rounded-md p-2 text-fg-muted hover:bg-tint/10 hover:text-fg-strong",
        className,
      )}
      onClick={() => setTheme(nextTheme)}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
