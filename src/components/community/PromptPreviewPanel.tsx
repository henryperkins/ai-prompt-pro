import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PromptPreviewPanelProps {
  text: string;
  mode?: "compact" | "full";
  className?: string;
}

const COMPACT_EXPAND_THRESHOLD = 260;

export function PromptPreviewPanel({ text, mode = "compact", className }: PromptPreviewPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const normalized = text.trim();

  useEffect(() => {
    setExpanded(false);
  }, [normalized]);

  const canExpand = mode === "compact" && normalized.length > COMPACT_EXPAND_THRESHOLD;
  const isCollapsed = mode === "compact" && !expanded && canExpand;

  return (
    <div className={cn("rounded-lg border border-border/80 bg-muted/35 p-3 sm:p-4", className)}>
      <div className="relative">
        <pre
          className={cn(
            "font-mono text-[11px] sm:text-xs leading-5 text-foreground/95 whitespace-pre-wrap break-words",
            isCollapsed && "line-clamp-6",
          )}
        >
          {normalized || "No prompt content available yet."}
        </pre>
        {isCollapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-lg bg-gradient-to-t from-[hsl(var(--muted)/0.35)] via-[hsl(var(--muted)/0.2)] to-transparent" />
        )}
      </div>
      {canExpand && (
        <div className="mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Collapse preview" : "Expand preview"}
          </Button>
        </div>
      )}
    </div>
  );
}
