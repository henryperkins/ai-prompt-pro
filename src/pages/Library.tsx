import { useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageShell, PageHero } from "@/components/PageShell";
import { PromptLibraryContent } from "@/components/PromptLibrary";
import { Card } from "@/components/ui/card";
import { ToastAction } from "@/components/ui/toast";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";
import { type PromptTemplate } from "@/lib/templates";
import * as persistence from "@/lib/persistence";

function toTemplateConfig(template: PromptTemplate): PromptConfig {
  return {
    ...defaultConfig,
    role: template.role,
    task: template.task,
    context: template.context,
    format: template.format,
    lengthPreference: template.lengthPreference,
    tone: template.tone,
    complexity: template.complexity,
    constraints: template.constraints,
    examples: template.examples,
  };
}

const Library = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const {
    templateSummaries,
    isSignedIn,
    deleteSavedTemplate,
    shareSavedPrompt,
    unshareSavedPrompt,
  } = usePromptBuilder();

  const handleSelectTemplate = useCallback(
    async (template: PromptTemplate) => {
      try {
        await persistence.saveDraft(userId, toTemplateConfig(template));
        toast({ title: `Template loaded: ${template.name}` });
        navigate("/");
      } catch (error) {
        toast({
          title: "Failed to load template",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [navigate, toast, userId],
  );

  const handleSelectSaved = useCallback(
    async (id: string) => {
      try {
        const loaded = await persistence.loadPromptById(userId, id);
        if (!loaded) {
          toast({ title: "Prompt not found", variant: "destructive" });
          return;
        }

        await persistence.saveDraft(userId, loaded.record.state.promptConfig);
        toast({
          title: `Prompt loaded: ${loaded.record.metadata.name}`,
          description:
            loaded.warnings.length > 0
              ? `${loaded.warnings.length} context warning(s).`
              : "Prompt restored successfully.",
        });
        navigate("/");
      } catch (error) {
        toast({
          title: "Failed to load prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [navigate, toast, userId],
  );

  const handleDeleteSaved = useCallback(
    async (id: string) => {
      try {
        const deleted = await deleteSavedTemplate(id);
        if (!deleted) {
          toast({ title: "Prompt not found", variant: "destructive" });
          return;
        }
        toast({ title: "Saved prompt deleted" });
      } catch (error) {
        toast({
          title: "Failed to delete prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [deleteSavedTemplate, toast],
  );

  const handleShareSaved = useCallback(
    async (id: string, input?: persistence.PromptShareInput) => {
      if (!isSignedIn) {
        toast({ title: "Sign in required", description: "Sign in to share prompts.", variant: "destructive" });
        return;
      }

      try {
        const result = await shareSavedPrompt(id, input);
        if (!result.shared) {
          toast({ title: "Prompt not found", variant: "destructive" });
          return;
        }
        toast({
          title: "Prompt shared to community",
          action: result.postId ? (
            <ToastAction altText="View post" asChild>
              <Link to={`/community/${result.postId}`}>View</Link>
            </ToastAction>
          ) : undefined,
        });
      } catch (error) {
        toast({
          title: "Failed to share prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [isSignedIn, shareSavedPrompt, toast],
  );

  const handleUnshareSaved = useCallback(
    async (id: string) => {
      try {
        const unshared = await unshareSavedPrompt(id);
        if (!unshared) {
          toast({ title: "Prompt not found", variant: "destructive" });
          return;
        }
        toast({ title: "Prompt removed from community" });
      } catch (error) {
        toast({
          title: "Failed to unshare prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [toast, unshareSavedPrompt],
  );

  return (
    <PageShell>
        <PageHero
          title="Prompt Library"
          subtitle="Load starter templates or your saved prompts directly into the Builder."
        />

        <Card className="border-border/80 bg-card/85 p-3 sm:max-h-[calc(100vh-220px)] sm:overflow-hidden sm:p-4">
          <div className="pr-1 sm:h-full sm:overflow-y-auto">
            <PromptLibraryContent
              savedPrompts={templateSummaries}
              canShareSavedPrompts={isSignedIn}
              onSelectTemplate={handleSelectTemplate}
              onSelectSaved={handleSelectSaved}
              onDeleteSaved={handleDeleteSaved}
              onShareSaved={handleShareSaved}
              onUnshareSaved={handleUnshareSaved}
            />
          </div>
        </Card>
    </PageShell>
  );
};

export default Library;
