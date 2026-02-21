import { BookOpen, History, Layers, Newspaper, PenSquare, Users, type LucideIcon } from "lucide-react";

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
  { to: "/feed", label: "Feed", icon: Newspaper, ariaLabel: "Open personal feed" },
  { to: "/library", label: "Library", icon: BookOpen, ariaLabel: "Open prompt library" },
  { to: "/history", label: "History", icon: History, ariaLabel: "Open version history" },
];

export const BOTTOM_NAV_ITEMS: ReadonlyArray<AppRouteNavItem> = APP_ROUTE_NAV_ITEMS;

export function isRouteActive(pathname: string, route: string): boolean {
  if (route === "/") return pathname === "/";
  return pathname.startsWith(route);
}
