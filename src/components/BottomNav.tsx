import { Link, useLocation } from "react-router-dom";
import { cx } from "@/lib/utils/cx";
import { BOTTOM_NAV_ITEMS, isRouteActive } from "@/lib/navigation";

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="pf-mobile-nav fixed inset-x-0 bottom-0 z-40 flex items-end justify-around border-t border-border bg-background/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur sm:hidden"
      aria-label="Mobile navigation"
    >
      {BOTTOM_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
        const isActive = isRouteActive(pathname, to);

        return (
          <Link
            key={to}
            to={to}
            className={cx(
              "mobile-route-link flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[0.875rem] leading-4 font-medium transition-colors",
              isActive
                ? "text-primary font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-[1.375rem] w-[1.375rem]" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
