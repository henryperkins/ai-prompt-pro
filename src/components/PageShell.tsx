import type { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface PageShellProps {
  children: ReactNode;
  mainClassName?: string;
}

export function PageShell({ children, mainClassName }: PageShellProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div
      className="min-h-screen bg-background flex flex-col pb-[calc(4.375rem+env(safe-area-inset-bottom))] sm:pb-0"
      data-testid="page-shell"
    >
      <Header isDark={isDark} onToggleTheme={toggleTheme} />
      <main
        className={cn("flex-1 container mx-auto px-4 py-4 sm:py-6", mainClassName)}
        data-testid="page-shell-main"
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

interface PageHeroProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  className?: string;
}

export function PageHero({ title, subtitle, eyebrow, className }: PageHeroProps) {
  return (
    <div className={cn("delight-hero mb-4 text-center sm:mb-6", className)}>
      {eyebrow && <p className="ui-section-label text-primary">{eyebrow}</p>}
      <h1 className="page-hero-title text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
      {subtitle && (
        <p className="page-hero-subtitle mx-auto mt-1 max-w-2xl text-sm text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  );
}
