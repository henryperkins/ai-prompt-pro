import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ThemeContext } from "@/hooks/theme-context";
import { getUserPreferences, setUserPreference, type ThemePreference } from "@/lib/user-preferences";

export interface ThemeContextValue {
  theme: ThemePreference;
  isMidnight: boolean;
  toggleTheme: () => void;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>(() => getUserPreferences().theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    setUserPreference("theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((previous) => (previous === "midnight" ? "default" : "midnight"));
  }, []);

  const isMidnight = theme === "midnight";

  return <ThemeContext.Provider value={{ theme, isMidnight, toggleTheme }}>{children}</ThemeContext.Provider>;
}
