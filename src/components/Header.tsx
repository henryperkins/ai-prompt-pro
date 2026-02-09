import { useState } from "react";
import { Moon, Sun, Zap, BookOpen, History, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenTemplates: () => void;
  onOpenHistory: () => void;
}

export function Header({ isDark, onToggleTheme, onOpenTemplates, onOpenHistory }: HeaderProps) {
  const { user, signOut } = useAuth();
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenTemplates}
              aria-label="Open presets"
              className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Presets</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenHistory}
              aria-label="Open version history"
              className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">History</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="interactive-chip w-8 h-8 sm:w-9 sm:h-9"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="interactive-chip w-8 h-8 sm:w-9 sm:h-9 rounded-full p-0">
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
                className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Sign in</span>
              </Button>
            )}
          </nav>
        </div>
      </header>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
