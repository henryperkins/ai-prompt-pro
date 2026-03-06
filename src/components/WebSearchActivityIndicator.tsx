import { useEffect, useState } from "react";
import { Globe, SpinnerGap as Loader2 } from "@phosphor-icons/react";
import { cx } from "@/lib/utils/cx";
import type { WebSearchPhase } from "@/lib/enhance-web-search-stream";

interface WebSearchActivityIndicatorProps {
  phase: WebSearchPhase;
  query: string | null;
  searchCount: number;
}

const FADE_OUT_DELAY_MS = 1500;

export function WebSearchActivityIndicator({
  phase,
  query,
  searchCount,
}: WebSearchActivityIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (phase === "searching") {
      setVisible(true);
      setFading(false);
    } else if (phase === "completed") {
      setVisible(true);
      setFading(false);
      const timer = setTimeout(() => setFading(true), FADE_OUT_DELAY_MS);
      return () => clearTimeout(timer);
    } else if (phase === "idle") {
      setFading(true);
    }
  }, [phase]);

  useEffect(() => {
    if (fading) {
      const timer = setTimeout(() => setVisible(false), 700);
      return () => clearTimeout(timer);
    }
  }, [fading]);

  if (!visible) return null;

  return (
    <div
      className={cx(
        "flex items-center gap-1.5 py-1 transition-opacity duration-700 ease-out",
        fading && "opacity-0",
      )}
      role="status"
      aria-live="polite"
      aria-label={
        phase === "searching"
          ? `Searching the web${query ? `: ${query}` : ""}`
          : `Web search complete. ${searchCount} search${searchCount !== 1 ? "es" : ""} used.`
      }
      data-testid="web-search-activity"
    >
      {phase === "searching" ? (
        <Loader2
          className="h-3 w-3 shrink-0 animate-spin text-muted-foreground"
          aria-hidden
        />
      ) : (
        <Globe className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className="text-xs text-muted-foreground">
        {phase === "searching" ? "Searching" : "Searched"}
      </span>
      {query && (
        <span className="min-w-0 max-w-60 truncate text-xs italic text-muted-foreground/80">
          "{query}"
        </span>
      )}
      {searchCount > 0 && (
        <span className="text-xs text-muted-foreground/60" aria-label={`${searchCount} searches`}>
          ·{searchCount}
        </span>
      )}
    </div>
  );
}
