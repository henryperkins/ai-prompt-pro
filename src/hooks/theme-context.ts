import { createContext } from "react";
import type { ThemeContextValue } from "@/hooks/theme-provider";

export const ThemeContext = createContext<ThemeContextValue | null>(null);
