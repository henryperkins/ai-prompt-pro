import { Link, useLocation } from "react-router-dom";
import { BookOpen, PenSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Builder", icon: PenSquare },
  { to: "/community", label: "Community", icon: Users },
  { to: "/library", label: "Library", icon: BookOpen },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background/95 backdrop-blur sm:hidden"
      aria-label="Mobile navigation"
    >
      {navItems.map(({ to, label, icon: Icon }) => {
        const isActive = to === "/" ? pathname === "/" : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors",
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
