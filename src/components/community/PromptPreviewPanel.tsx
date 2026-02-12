import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PromptPreviewPanelProps {
  text: string;
  mode?: "compact" | "full";
  className?: string;
  onCopy?: () => void | Promise<void>;
}

const COMPACT_EXPAND_THRESHOLD = 260;

export function PromptPreviewPanel({ text, mode = "compact", className, onCopy }: PromptPreviewPanelProps) {
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
        {onCopy && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute right-2 top-2 z-10 h-7 px-2 text-[11px] bg-background/85 backdrop-blur"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void onCopy();
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
        )}
        <pre
          className={cn(
            "font-mono text-[11px] sm:text-xs leading-5 text-foreground/95 whitespace-pre-wrap break-words",
            onCopy && "pr-14",
            isCollapsed && "line-clamp-6",
          )}
        >
          {normalized || "No prompt content available yet."}
        </pre>
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
