import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV_ITEMS, PRESETS_NAV_ITEM, isRouteActive } from "@/lib/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const PresetsIcon = PRESETS_NAV_ITEM.icon;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background/95 backdrop-blur sm:hidden"
      aria-label="Mobile navigation"
    >
      {BOTTOM_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
        const isActive = isRouteActive(pathname, to);
        const isBuilder = to === "/";
        const isPresetsActive = isRouteActive(pathname, "/presets");

        if (isBuilder) {
          return (
            <Popover key={to} open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "mobile-route-link flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors",
                    isActive || isPresetsActive
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={(e) => {
                    if (popoverOpen) return;
                    if (!isActive) {
                      e.preventDefault();
                      navigate(to);
                    }
                  }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                sideOffset={8}
                className="w-auto min-w-[8rem] p-1"
              >
                <Link
                  to="/"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "hover:bg-accent hover:text-accent-foreground",
                  )}
                  onClick={() => setPopoverOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  Builder
                </Link>
                <Link
                  to="/presets"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    isPresetsActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "hover:bg-accent hover:text-accent-foreground",
                  )}
                  onClick={() => setPopoverOpen(false)}
                >
                  <PresetsIcon className="h-4 w-4" />
                  Presets
                </Link>
              </PopoverContent>
            </Popover>
          );
        }

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
