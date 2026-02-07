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
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
            <Zap className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">PromptForge</span>
        </div>

        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onOpenTemplates} className="gap-2">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Templates</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onOpenHistory} className="gap-2">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={onToggleTheme} aria-label="Toggle theme">
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </nav>
      </div>
    </header>
  );
}
