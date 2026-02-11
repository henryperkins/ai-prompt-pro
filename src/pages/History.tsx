import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { VersionHistoryContent } from "@/components/VersionHistory";
import { Card } from "@/components/ui/card";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import { useToast } from "@/hooks/use-toast";
import { queueRestoredVersionPrompt } from "@/lib/history-restore";

const History = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { versions } = usePromptBuilder();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

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
    <div className="min-h-screen bg-background flex flex-col">
      <Header isDark={isDark} onToggleTheme={() => setIsDark((prev) => !prev)} />

      <main className="flex-1 container mx-auto px-4 py-4 sm:py-6">
        <div className="delight-hero mb-4 text-center sm:mb-6">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Version History</h1>
          <p className="mx-auto mt-1 max-w-2xl text-sm text-muted-foreground">
            Restore any previously saved prompt version back into the Builder.
          </p>
        </div>

        <Card className="max-h-[calc(100vh-220px)] overflow-hidden border-border/80 bg-card/85 p-3 sm:p-4">
          <VersionHistoryContent
            versions={versions}
            onRestore={handleRestore}
            className="h-full max-h-[calc(100vh-260px)] pr-1"
          />
        </Card>
      </main>
    </div>
  );
};

export default History;
