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
  const isFull = mode === "full";

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
    <div
      className={cn(
        "rounded-lg border p-3 sm:p-4",
        isFull
          ? "border-border/70 bg-background/80 shadow-sm"
          : "border-border/80 bg-muted/35",
        className,
      )}
    >
      <div className={cn("relative", isFull && "mx-auto max-w-[108ch]") }>
        {onCopy && (
          <Button
            type="button"
            color="secondary"
            size="sm"
            className={cn(
              "type-button-label utility-action-button utility-action-button--floating absolute z-10",
              isFull ? "right-3 top-3" : "right-2 top-2",
            )}
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
            "type-code type-wrap-safe whitespace-pre-wrap font-mono text-foreground antialiased",
            isFull
              ? "text-[0.93rem] leading-6 sm:text-[0.97rem] sm:leading-7"
              : "text-[0.88rem] leading-6 text-foreground/95 sm:text-[0.92rem]",
            onCopy && (isFull ? "pr-20 sm:pr-24" : "pr-[4.5rem] sm:pr-14"),
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
            color="secondary"
            size="sm"
            className="type-button-label h-11 px-4 font-semibold sm:h-9 sm:px-3"
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
