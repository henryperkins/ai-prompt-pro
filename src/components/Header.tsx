import { useState } from "react";
import { Moon, Sun, Zap, BookOpen, History, LogIn, LogOut, Users, PenSquare, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export function Header({ isDark, onToggleTheme }: HeaderProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const isBuilderRoute = location.pathname === "/";
  const isCommunityRoute = location.pathname.startsWith("/community");
  const isLibraryRoute = location.pathname.startsWith("/library");
  const isHistoryRoute = location.pathname.startsWith("/history");

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
                  aria-label="Open navigation menu"
                  className="interactive-chip w-11 h-11 sm:hidden"
                >
                  <Menu className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="sm:hidden">
                <DropdownMenuItem asChild>
                  <Link to="/" className="flex items-center gap-2">
                    <PenSquare className="w-4 h-4" />
                    Builder
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/community" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Community
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/library" className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Library
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/history" className="flex items-center gap-2">
                    <History className="w-4 h-4" />
                    History
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              asChild
              variant={isBuilderRoute ? "outline" : "ghost"}
              size="sm"
              className="interactive-chip hidden sm:inline-flex gap-1.5 sm:gap-2 h-11 sm:h-9 px-2 sm:px-3"
            >
              <Link to="/" aria-label="Open builder">
                <PenSquare className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Builder</span>
              </Link>
            </Button>
            <Button
              asChild
              variant={isCommunityRoute ? "outline" : "ghost"}
              size="sm"
              className="interactive-chip hidden sm:inline-flex gap-1.5 sm:gap-2 h-11 sm:h-9 px-2 sm:px-3"
            >
              <Link to="/community" aria-label="Open community">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Community</span>
              </Link>
            </Button>
            <Button
              asChild
              variant={isLibraryRoute ? "outline" : "ghost"}
              size="sm"
              className="interactive-chip hidden sm:inline-flex gap-1.5 sm:gap-2 h-11 sm:h-9 px-2 sm:px-3"
            >
              <Link to="/library" aria-label="Open prompt library">
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Library</span>
              </Link>
            </Button>
            <Button
              asChild
              variant={isHistoryRoute ? "outline" : "ghost"}
              size="sm"
              className="interactive-chip hidden sm:inline-flex gap-1.5 sm:gap-2 h-11 sm:h-9 px-2 sm:px-3"
            >
              <Link to="/history" aria-label="Open version history">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">History</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="interactive-chip w-11 h-11 sm:w-9 sm:h-9"
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
                    className="interactive-chip w-11 h-11 sm:w-9 sm:h-9 rounded-full p-0"
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
                className="interactive-chip gap-1.5 sm:gap-2 h-11 sm:h-9 px-2 sm:px-3"
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
