"use client";

import { Palette } from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import { THEME_ICONS } from "@/components/theme/theme-switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { THEME_LABELS, THEMES, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const THEME_DESCRIPTIONS: Record<Theme, string> = {
  dark: "The original dark dashboard.",
  light: "Light backgrounds with dark text.",
};

// A small picture of the platform drawn with the theme's own tokens.
function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        theme,
        "flex h-24 overflow-hidden rounded-md border border-tint/10 bg-background",
      )}
    >
      <div className="w-1/4 space-y-1.5 border-r border-tint/10 bg-panel p-2">
        <div className="h-1.5 w-3/4 rounded-full bg-brand" />
        <div className="h-1.5 w-full rounded-full bg-tint/15" />
        <div className="h-1.5 w-2/3 rounded-full bg-tint/15" />
      </div>
      <div className="flex-1 space-y-2 p-2">
        <div className="h-2 w-1/2 rounded-full bg-fg-strong/80" />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5 rounded border border-tint/10 bg-surface p-2">
            <div className="h-1.5 w-2/3 rounded-full bg-fg-subtle/60" />
            <div className="h-2.5 w-1/2 rounded-full bg-fg-strong" />
          </div>
          <div className="space-y-1.5 rounded border border-tint/10 bg-surface p-2">
            <div className="h-1.5 w-2/3 rounded-full bg-fg-subtle/60" />
            <div className="h-2.5 w-1/3 rounded-full bg-brand" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppearanceCard() {
  const { setTheme, theme } = useTheme();

  return (
    <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-fg-strong">
          <Palette aria-hidden="true" className="h-5 w-5 text-brand" />
          Appearance
        </CardTitle>
        <CardDescription>
          Choose Light or Dark for every page. The choice is saved on this browser and
          kept after you sign out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset>
          <legend className="sr-only">Theme</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {THEMES.map((option) => {
              const Icon = THEME_ICONS[option];
              const isSelected = theme === option;

              return (
                <label
                  className={cn(
                    "flex cursor-pointer flex-col gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand",
                    isSelected
                      ? "border-brand/60 bg-brand/[0.06]"
                      : "border-tint/10 hover:border-tint/15",
                  )}
                  key={option}
                >
                  <ThemePreview theme={option} />
                  <span className="flex items-center gap-2 text-sm font-medium text-fg-strong">
                    <input
                      checked={isSelected}
                      className="h-4 w-4 accent-brand-vivid"
                      name="theme"
                      onChange={() => setTheme(option)}
                      type="radio"
                      value={option}
                    />
                    <Icon aria-hidden="true" className="h-4 w-4 text-fg-muted" />
                    {THEME_LABELS[option]}
                  </span>
                  <span className="text-xs text-fg-muted">{THEME_DESCRIPTIONS[option]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}
