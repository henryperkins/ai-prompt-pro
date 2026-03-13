import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell, PageHero } from "@/components/PageShell";
import { VersionHistoryContent } from "@/components/VersionHistory";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/card";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import { useToast } from "@/hooks/use-toast";
import { brandCopy } from "@/lib/brand-copy";
import { queueRestoredVersionPrompt } from "@/lib/history-restore";

const History = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { versions } = usePromptBuilder();

  const handleRestore = useCallback(
    (prompt: string) => {
      const queued = queueRestoredVersionPrompt(prompt);
      if (!queued) {
        toast({
          title: "Restore failed",
          description: "Could not transfer this version to Builder. Try again.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Version ready", description: "Restored prompt sent to Builder." });
      navigate("/");
    },
    [navigate, toast],
  );

  return (
    <PageShell>
      <PageHero
        eyebrow={brandCopy.brandLine}
        title="Version History"
        subtitle="Restore a saved draft to Builder, or pivot to Presets when you need a fresh starting point."
      />

      {versions.length > 0 ? (
        <Card className="pf-card mb-4 border-border/80 bg-card/85 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="ui-section-label text-primary">Next step</p>
              <p className="text-sm text-muted-foreground">
                Restore a version below, return to Builder to keep drafting, or open Presets for a clean scaffold.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button href="/" variant="primary" size="sm" className="h-11 sm:h-9">
                Open Builder
              </Button>
              <Button href="/presets" variant="secondary" size="sm" className="h-11 sm:h-9">
                Open Presets
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="pf-card border-border/80 bg-card/85 p-3 sm:max-h-[calc(100vh-220px)] sm:overflow-hidden sm:p-4">
        <VersionHistoryContent
          versions={versions}
          onRestore={handleRestore}
          className="pr-1 sm:h-full sm:max-h-[calc(100vh-260px)]"
        />
      </Card>
    </PageShell>
  );
};

export default History;
