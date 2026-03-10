import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/base/dialog";
import type { LineDiffResult, DiffLine } from "@/lib/text-diff";
import {
  UI_STATUS_ROW_CLASSES,
} from "@/lib/ui-status";

interface OutputPanelCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diff: LineDiffResult | null;
  hasCompare: boolean;
}

function DiffRow({ line }: { line: DiffLine }) {
  const marker = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
  const rowClass =
    line.type === "add"
      ? UI_STATUS_ROW_CLASSES.success
      : line.type === "remove"
        ? UI_STATUS_ROW_CLASSES.danger
        : "text-foreground";

  return (
    <div className={`px-3 whitespace-pre-wrap wrap-break-word ${rowClass}`}>
      <span className="inline-block w-4 select-none">{marker}</span>
      {line.value}
    </div>
  );
}

export function OutputPanelCompareDialog({
  open,
  onOpenChange,
  diff,
  hasCompare,
}: OutputPanelCompareDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Before vs After</DialogTitle>
          <DialogDescription>
            {diff
              ? `${diff.added} added, ${diff.removed} removed`
              : hasCompare
                ? "Preparing comparison."
                : "Generate an enhanced prompt to compare changes."}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-card overflow-auto flex-1 min-h-[280px]">
          <div className="font-mono text-xs leading-relaxed">
            <div className="px-3 py-1.5 border-b border-border text-muted-foreground">
              --- before
            </div>
            <div className="px-3 py-1.5 border-b border-border text-muted-foreground">
              +++ after
            </div>
            {diff?.lines.map((line, index) => (
              <DiffRow key={`${line.type}-${index}`} line={line} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
