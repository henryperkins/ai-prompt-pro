import { type ReactNode, useEffect, useState } from "react";
import { Card } from "@/components/base/card";
import { cx } from "@/lib/utils/cx";
import { CaretRight } from "@phosphor-icons/react";

interface OutputPanelDetailsAccordionProps {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  testId: string;
}

export function OutputPanelDetailsAccordion({
  title,
  summary,
  defaultOpen = false,
  children,
  testId,
}: OutputPanelDetailsAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) {
      setIsOpen(true);
    }
  }, [defaultOpen]);

  return (
    <Card className="overflow-hidden border-border/60 bg-card/70 p-0" data-testid={testId}>
      <div className="group"
      >
        <button
          type="button"
          aria-controls={`${testId}-content`}
          aria-expanded={isOpen}
          className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden"
          data-testid={`${testId}-trigger`}
          onClick={() => setIsOpen((current) => !current)}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{title}</p>
            {summary ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {summary}
              </p>
            ) : null}
          </div>
          <CaretRight
            aria-hidden="true"
            className={cx(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-90",
            )}
          />
        </button>
        {isOpen ? (
          <div
            id={`${testId}-content`}
            className="space-y-3 border-t border-border/50 px-3 pb-3 pt-3"
          >
            {children}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
