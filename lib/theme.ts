// Light / Dark appearance. Shared by the root layout (server) and the theme
// switch (client). The choice is stored in a cookie on this browser, so it
// survives refresh, navigation and sign-out/sign-in without a database change.

export const THEMES = ["light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

// Dark is the platform's original look.
export const DEFAULT_THEME: Theme = "dark";

export const THEME_COOKIE = "qa-theme";

export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const THEME_LABELS: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEMES.includes(value as Theme);
}

export function parseTheme(value: unknown): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}
