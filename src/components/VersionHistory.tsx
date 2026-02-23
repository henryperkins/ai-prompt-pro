import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/base/primitives/sheet";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/primitives/card";
import { RotateCcw } from "lucide-react";
import { StateCard } from "@/components/base/primitives/state-card";

interface Version {
  id: string;
  name: string;
  prompt: string;
  timestamp: number;
}

interface VersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: Version[];
  onRestore: (prompt: string) => void;
}

export function VersionHistory({ open, onOpenChange, versions, onRestore }: VersionHistoryProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[400px] md:w-[540px]">
        <SheetHeader>
          <SheetTitle className="text-foreground">Version History</SheetTitle>
        </SheetHeader>
        <VersionHistoryContent
          versions={versions}
          onRestore={(prompt) => {
            onRestore(prompt);
            onOpenChange(false);
          }}
          className="mt-4 sm:mt-6 max-h-[calc(100vh-120px)]"
        />
      </SheetContent>
    </Sheet>
  );
}

export function VersionHistoryContent({
  versions,
  onRestore,
  className,
}: {
  versions: Version[];
  onRestore: (prompt: string) => void;
  className?: string;
}) {
  return (
    <div className={`space-y-2 sm:space-y-3 overflow-y-auto ${className ?? ""}`.trim()}>
      {versions.length === 0 ? (
        <StateCard
          variant="empty"
          title="No saved versions yet"
          description="Save a prompt to create restorable versions in this history panel."
          primaryAction={{ label: "Go to Builder", to: "/" }}
        />
      ) : (
        versions.map((version) => (
          <Card key={version.id} className="p-3 sm:p-4 group">
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{version.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(version.timestamp).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5 sm:mt-2 line-clamp-3 font-mono">
                  {version.prompt}
                </p>
              </div>
              <Button
                color="tertiary"
                size="sm"
                className="shrink-0 gap-1 text-xs"
                onClick={() => onRestore(version.prompt)}
              >
                <RotateCcw className="w-3 h-3" />
                Restore
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
