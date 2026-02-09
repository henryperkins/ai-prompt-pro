import { Moon, Sun, Zap, BookOpen, History } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenTemplates: () => void;
  onOpenHistory: () => void;
}

export function Header({ isDark, onToggleTheme, onOpenTemplates, onOpenHistory }: HeaderProps) {
  return (
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
        </nav>
      </div>
    </header>
  );
}
