import { createContext } from "react";

export type SelectSize = "sm" | "md";

export const selectSizes = {
  sm: { root: "py-2 px-3", shortcut: "pr-2.5" },
  md: { root: "py-2.5 px-3.5", shortcut: "pr-3" },
} as const;

export const SelectContext = createContext<{ size: SelectSize }>({ size: "sm" });
