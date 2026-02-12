import { BookOpen, History, Layers, PenSquare, Users, type LucideIcon } from "lucide-react";

export interface AppRouteNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  ariaLabel: string;
}

export const APP_ROUTE_NAV_ITEMS: ReadonlyArray<AppRouteNavItem> = [
  { to: "/", label: "Builder", icon: PenSquare, ariaLabel: "Open builder" },
  { to: "/presets", label: "Presets", icon: Layers, ariaLabel: "Browse preset templates" },
  { to: "/community", label: "Community", icon: Users, ariaLabel: "Open community" },
  { to: "/library", label: "Library", icon: BookOpen, ariaLabel: "Open prompt library" },
  { to: "/history", label: "History", icon: History, ariaLabel: "Open version history" },
];

/** Mobile bottom nav: 4 items (Presets accessible via Builder popover). */
export const BOTTOM_NAV_ITEMS: ReadonlyArray<AppRouteNavItem> = APP_ROUTE_NAV_ITEMS.filter(
  (item) => item.to !== "/presets",
);

export const PRESETS_NAV_ITEM: AppRouteNavItem = APP_ROUTE_NAV_ITEMS.find(
  (item) => item.to === "/presets",
)!;

export function isRouteActive(pathname: string, route: string): boolean {
  if (route === "/") return pathname === "/";
  return pathname.startsWith(route);
}
