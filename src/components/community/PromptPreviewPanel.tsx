import { useState } from "react";
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
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const normalized = text.trim();

  const canExpand = mode === "compact" && normalized.length > COMPACT_EXPAND_THRESHOLD;
  const isExpanded = expandedFor === normalized;
  const isCollapsed = mode === "compact" && !isExpanded && canExpand;

  return (
    <div className={cn("rounded-lg border border-border/80 bg-muted/35 p-3 sm:p-4", className)}>
      <div className="relative">
        {onCopy && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="type-button-label absolute right-2 top-2 z-10 h-11 bg-background/85 px-3 backdrop-blur sm:h-9 sm:px-2"
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
            "type-code type-wrap-safe font-mono text-foreground/95 whitespace-pre-wrap",
            onCopy && "pr-20 sm:pr-14",
            isCollapsed && "line-clamp-6",
          )}
        >
          {normalized || "No prompt content yet."}
        </pre>
      </div>
      {canExpand && (
        <div className="mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="type-button-label h-11 px-3 sm:h-9 sm:px-2"
            onClick={() => setExpandedFor((previous) => (previous === normalized ? null : normalized))}
          >
            {isExpanded ? "Show less" : "Read more"}
          </Button>
        </div>
      )}
    </div>
  );
}
