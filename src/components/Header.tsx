import { useState } from "react";
import { Menu, Moon, Sun, Zap, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";
import { APP_ROUTE_NAV_ITEMS, isRouteActive } from "@/lib/navigation";

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export function Header({ isDark, onToggleTheme }: HeaderProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);

  const initials = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string)
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user?.email
      ? user.email[0].toUpperCase()
      : "?";

  return (
    <>
      <header className="border-b border-border/80 bg-card/75 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between h-12 sm:h-14 px-3 sm:px-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="interactive-chip flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary text-primary-foreground">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <span className="text-base sm:text-lg font-bold text-foreground tracking-tight">PromptForge</span>
          </div>

          <nav className="flex items-center gap-0.5 sm:gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open utilities menu"
                  className="interactive-chip w-11 h-11 sm:hidden"
                >
                  <Menu className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="sm:hidden min-w-[220px]">
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    onToggleTheme();
                  }}
                >
                  {isDark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                  {isDark ? "Switch to light mode" : "Switch to dark mode"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {user ? (
                  <>
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                      {user.email}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        void signOut();
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign out
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      setAuthOpen(true);
                    }}
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign in
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {APP_ROUTE_NAV_ITEMS.map(({ to, label, icon: Icon, ariaLabel }) => (
              <Button
                key={to}
                asChild
                variant={isRouteActive(location.pathname, to) ? "outline" : "ghost"}
                size="sm"
                className="interactive-chip hidden sm:inline-flex gap-1.5 sm:gap-2 h-11 sm:h-9 px-2 sm:px-3"
              >
                <Link to={to} aria-label={ariaLabel}>
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">{label}</span>
                </Link>
              </Button>
            ))}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="interactive-chip hidden sm:inline-flex w-11 h-11 sm:w-9 sm:h-9"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open account menu"
                    className="interactive-chip hidden sm:inline-flex w-11 h-11 sm:w-9 sm:h-9 rounded-full p-0"
                  >
                    <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
                      <AvatarImage src={user.user_metadata?.avatar_url as string | undefined} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAuthOpen(true)}
                aria-label="Sign in"
                className="interactive-chip hidden sm:inline-flex gap-1.5 sm:gap-2 h-11 sm:h-9 px-2 sm:px-3"
              >
                <LogIn className="w-4 h-4" />
                <span className="sr-only sm:not-sr-only sm:inline text-sm">Sign in</span>
              </Button>
            )}
          </nav>
        </div>
      </header>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
