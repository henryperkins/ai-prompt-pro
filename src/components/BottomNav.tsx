import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV_ITEMS, isRouteActive } from "@/lib/navigation";

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-end justify-around border-t border-border bg-background/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur sm:hidden"
      aria-label="Mobile navigation"
    >
      {BOTTOM_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
        const isActive = isRouteActive(pathname, to);

        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "mobile-route-link flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-2 text-xs leading-5 font-medium transition-colors",
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
