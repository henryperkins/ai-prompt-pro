import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { APP_ROUTE_NAV_ITEMS, isRouteActive } from "@/lib/navigation";

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background/95 backdrop-blur sm:hidden"
      aria-label="Mobile navigation"
    >
      {APP_ROUTE_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
        const isActive = isRouteActive(pathname, to);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "mobile-route-link flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors",
              isActive
                ? "text-primary font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
