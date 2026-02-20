import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getUserPreferences, setUserPreference } from "@/lib/user-preferences";

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => getUserPreferences().theme === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    setUserPreference("theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark((previous) => !previous);
  }, []);

  return <ThemeContext.Provider value={{ isDark, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
