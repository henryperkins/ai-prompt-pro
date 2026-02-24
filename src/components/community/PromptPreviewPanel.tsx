import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { cn } from "@/lib/utils";
import { Copy } from "@phosphor-icons/react";

interface PromptPreviewPanelProps {
  text: string;
  mode?: "compact" | "full";
  className?: string;
  onCopy?: () => void | Promise<void>;
}

export function PromptPreviewPanel({ text, mode = "compact", className, onCopy }: PromptPreviewPanelProps) {
  const preRef = useRef<HTMLPreElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const normalized = text.trim();
  const isCompact = mode === "compact";

  useEffect(() => {
    setIsExpanded(false);
  }, [isCompact, normalized]);

  useEffect(() => {
    if (!isCompact) {
      setHasOverflow(false);
      return;
    }

    if (isExpanded) return;

    const element = preRef.current;
    if (!element) {
      setHasOverflow(false);
      return;
    }

    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      setHasOverflow(element.scrollHeight - element.clientHeight > 1);
    };

    const rafId = window.requestAnimationFrame(measure);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    void document.fonts?.ready.then(measure);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, [isCompact, isExpanded, normalized]);

  const canExpand = isCompact && hasOverflow;
  const isCollapsed = isCompact && !isExpanded;

  return (
    <div className={cn("rounded-lg border border-border/80 bg-muted/35 p-3 sm:p-4", className)}>
      <div className="relative">
        {onCopy && (
          <Button
            type="button"
            color="secondary"
            size="sm"
            className="type-button-label utility-action-button utility-action-button--floating absolute right-2 top-2 z-10"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void onCopy();
            }}
          >
            <Copy />
            Copy
          </Button>
        )}
        <pre
          ref={preRef}
          className={cn(
            "type-code type-wrap-safe font-mono text-foreground/95 whitespace-pre-wrap",
            onCopy && "pr-[4.5rem] sm:pr-14",
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
            color="tertiary"
            size="sm"
            className="type-button-label h-11 px-3 sm:h-9 sm:px-2"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((previous) => !previous)}
          >
            {isExpanded ? "Show less" : "Read more"}
          </Button>
        </div>
      )}
    </div>
  );
}
