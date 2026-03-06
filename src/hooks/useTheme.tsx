import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getUserPreferences, setUserPreference, type ThemePreference } from "@/lib/user-preferences";

interface ThemeContextValue {
  theme: ThemePreference;
  isMidnight: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>(() => getUserPreferences().theme);

  useEffect(() => {
    const isMidnight = theme === "midnight";
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", isMidnight);
    document.documentElement.classList.toggle("dark-mode", isMidnight);
    setUserPreference("theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((previous) => (previous === "midnight" ? "default" : "midnight"));
  }, []);

  const isMidnight = theme === "midnight";

  return <ThemeContext.Provider value={{ theme, isMidnight, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
