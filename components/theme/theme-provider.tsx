"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE_SECONDS,
  THEMES,
  type Theme,
} from "@/lib/theme";

type ThemeContextValue = {
  setTheme: (theme: Theme) => void;
  theme: Theme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // Switch without every transition-colors element animating at once.
  const pauseTransitions = document.createElement("style");

  pauseTransitions.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(pauseTransitions);
  root.classList.remove(...THEMES);
  root.classList.add(theme);
  window.getComputedStyle(root).getPropertyValue("color");
  window.setTimeout(() => pauseTransitions.remove(), 0);
}

function saveTheme(theme: Theme) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [serverTheme, setServerTheme] = useState<Theme>(initialTheme);

  // The server re-renders the layout from the cookie (for example after
  // router.refresh()); keep the switch in step with it.
  if (initialTheme !== serverTheme) {
    setServerTheme(initialTheme);
    setThemeState(initialTheme);
  }

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    saveTheme(nextTheme);
  }, []);

  const value = useMemo(() => ({ setTheme, theme }), [setTheme, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}
