import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";
import { brandCopy } from "@/lib/brand-copy";
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
      <footer className="border-t border-border/70 bg-card/55">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-2 sm:flex-row sm:gap-4">
          <Link
            to="/"
            className="interactive-chip inline-flex items-center gap-1.5 rounded-md px-1 py-0.5"
            aria-label={brandCopy.appName}
          >
            <img
              src="/brand/pf-logo-monogram-badge-v2.png"
              alt=""
              decoding="async"
              className="h-7 w-7 object-contain"
              aria-hidden="true"
            />
            <img
              src="/brand/pf-logo-wordmark-horizontal-v3-tight.png"
              alt=""
              decoding="async"
              className="h-5 w-auto object-contain"
              aria-hidden="true"
            />
          </Link>

          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </footer>
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
      <div className="mb-2 flex items-center justify-center gap-2">
        <img
          src="/brand/pf-logo-monogram-badge-v2.png"
          alt=""
          decoding="async"
          className="h-5 w-5 object-contain"
          aria-hidden="true"
        />
        <img
          src="/brand/pf-logo-wordmark-horizontal-v3-tight.png"
          alt=""
          decoding="async"
          className="h-4 w-auto object-contain"
          aria-hidden="true"
        />
      </div>
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
