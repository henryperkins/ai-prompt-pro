import {
  BookOpen,
  ClockCounterClockwise as History,
  PencilSimple as PenSquare,
  Stack as Layers,
  Users,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

export interface AppRouteNavItem {
  to: string;
  label: string;
  icon: Icon;
  ariaLabel: string;
}

export const APP_ROUTE_NAV_ITEMS: ReadonlyArray<AppRouteNavItem> = [
  { to: "/", label: "Builder", icon: PenSquare, ariaLabel: "Open builder" },
  { to: "/presets", label: "Presets", icon: Layers, ariaLabel: "Browse preset templates" },
  { to: "/community", label: "Community", icon: Users, ariaLabel: "Open community" },
  { to: "/library", label: "Library", icon: BookOpen, ariaLabel: "Open prompt library" },
  { to: "/history", label: "History", icon: History, ariaLabel: "Open version history" },
];

export const BOTTOM_NAV_ITEMS: ReadonlyArray<AppRouteNavItem> = APP_ROUTE_NAV_ITEMS;

export function isRouteActive(pathname: string, route: string): boolean {
  if (route === "/") return pathname === "/";
  return pathname.startsWith(route);
}
