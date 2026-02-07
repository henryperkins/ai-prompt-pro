import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, RotateCcw } from "lucide-react";

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
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="text-foreground">Version History</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
          {versions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No saved versions yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Save a prompt to see it here.</p>
            </div>
          ) : (
            versions.map((version) => (
              <Card key={version.id} className="p-4 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{version.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(version.timestamp).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-3 font-mono">
                      {version.prompt}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      onRestore(version.prompt);
                      onOpenChange(false);
                    }}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
