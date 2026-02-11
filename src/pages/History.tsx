import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell, PageHero } from "@/components/PageShell";
import { VersionHistoryContent } from "@/components/VersionHistory";
import { Card } from "@/components/ui/card";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import { useToast } from "@/hooks/use-toast";
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
          title="Version History"
          subtitle="Restore any previously saved prompt version back into the Builder."
        />

        <Card className="border-border/80 bg-card/85 p-3 sm:max-h-[calc(100vh-220px)] sm:overflow-hidden sm:p-4">
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
