import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { PromptInput } from "@/components/PromptInput";
import { BuilderTabs } from "@/components/BuilderTabs";
import { ContextPanel } from "@/components/ContextPanel";
import { ToneControls } from "@/components/ToneControls";
import { QualityScore } from "@/components/QualityScore";
import { OutputPanel } from "@/components/OutputPanel";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import { streamEnhance } from "@/lib/ai-client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PromptTemplate } from "@/lib/templates";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Eye, Target, Layout as LayoutIcon, MessageSquare, BarChart3 } from "lucide-react";

const TemplateLibrary = lazy(async () => {
  const module = await import("@/components/TemplateLibrary");
  return { default: module.TemplateLibrary };
});

const VersionHistory = lazy(async () => {
  const module = await import("@/components/VersionHistory");
  return { default: module.VersionHistory };
});

const Index = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const {
    config,
    updateConfig,
    resetConfig,
    builtPrompt,
    score,
    enhancedPrompt,
    setEnhancedPrompt,
    isEnhancing,
    setIsEnhancing,
    versions,
    saveVersion,
    loadTemplate,
    saveAsTemplate,
    loadSavedTemplate,
    deleteSavedTemplate,
    templateSummaries,
    updateContextSources,
    updateDatabaseConnections,
    updateRagParameters,
    updateContextStructured,
    updateContextInterview,
    updateProjectNotes,
    toggleDelimiters,
  } = usePromptBuilder();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const handleEnhance = useCallback(() => {
    if (!builtPrompt || isEnhancing) return;
    setIsEnhancing(true);
    setEnhancedPrompt("");

    if (isMobile) setDrawerOpen(true);

    let accumulated = "";
    streamEnhance({
      prompt: builtPrompt,
      onDelta: (text) => {
        accumulated += text;
        setEnhancedPrompt(accumulated);
      },
      onDone: () => {
        setIsEnhancing(false);
        toast({ title: "Prompt enhanced!", description: "Your prompt has been optimized by AI." });
      },
      onError: (error) => {
        setIsEnhancing(false);
        toast({ title: "Enhancement failed", description: error, variant: "destructive" });
      },
    });
  }, [builtPrompt, isEnhancing, setIsEnhancing, setEnhancedPrompt, toast, isMobile]);

  const handleSelectTemplate = useCallback(
    (template: PromptTemplate) => {
      loadTemplate(template);
      toast({ title: `Template loaded: ${template.name}` });
    },
    [loadTemplate, toast]
  );

  const handleSelectSavedTemplate = useCallback(
    (id: string) => {
      const loaded = loadSavedTemplate(id);
      if (!loaded) {
        toast({ title: "Template not found", variant: "destructive" });
        return;
      }
      toast({
        title: `Template loaded: ${loaded.record.metadata.name}`,
        description:
          loaded.warnings.length > 0
            ? `${loaded.warnings.length} context warning(s). Review integrations before running.`
            : "Template restored successfully.",
      });
    },
    [loadSavedTemplate, toast]
  );

  const handleDeleteSavedTemplate = useCallback(
    (id: string) => {
      const deleted = deleteSavedTemplate(id);
      if (!deleted) {
        toast({ title: "Template not found", variant: "destructive" });
        return;
      }
      toast({ title: "Saved template deleted" });
    },
    [deleteSavedTemplate, toast]
  );

  const handleSaveAsTemplate = useCallback(
    (input: { name: string; description?: string }) => {
      try {
        const result = saveAsTemplate(input);
        const warningText =
          result.warnings.length > 0
            ? ` ${result.warnings.length} validation warning(s) were recorded.`
            : "";
        const verb =
          result.outcome === "created"
            ? "saved"
            : result.outcome === "updated"
              ? "updated"
              : "unchanged";
        toast({
          title: `Template ${verb}: ${result.record.metadata.name}`,
          description: `Revision r${result.record.metadata.revision}.${warningText}`,
        });
      } catch (error) {
        toast({
          title: "Failed to save template",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [saveAsTemplate, toast]
  );

  // Keyboard shortcut: Ctrl+Enter to enhance
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleEnhance();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleEnhance]);

  // Status indicators for accordion triggers
  const sourceCount = config.contextConfig.sources.length;
  const displayPrompt = enhancedPrompt || builtPrompt;
  const canSaveTemplate =
    !!config.task.trim() ||
    !!config.originalPrompt.trim() ||
    config.contextConfig.sources.length > 0 ||
    config.contextConfig.databaseConnections.length > 0 ||
    !!config.contextConfig.rag.vectorStoreRef.trim();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      <main className="flex-1 container mx-auto px-4 py-3 sm:py-6">
        {/* Hero — compact on mobile */}
        <div className="text-center mb-4 sm:mb-8">
          <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-foreground mb-1 sm:mb-2 tracking-tight">
            Transform Basic Prompts into
            <span className="text-primary"> Pro-Level Instructions</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm md:text-base max-w-xl mx-auto hidden sm:block">
            Build structured, effective prompts that get better AI results—every time.
            No prompt engineering expertise required.
          </p>
        </div>

        {/* Split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Left: Input & Builder — accordion on all sizes for consistency */}
          <div className="space-y-3 sm:space-y-4">
            {/* Prompt input always visible */}
            <PromptInput
              value={config.originalPrompt}
              onChange={(v) => updateConfig({ originalPrompt: v, task: v })}
              onReset={resetConfig}
            />

            {/* Accordion sections */}
            <Accordion
              type="multiple"
              defaultValue={["builder"]}
              className="space-y-1"
            >
              <AccordionItem value="builder" className="border rounded-lg px-3">
                <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                  <span className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-muted-foreground" />
                    Builder
                  </span>
                  {config.role && (
                    <Badge variant="secondary" className="ml-auto mr-2 text-[10px]">
                      {config.customRole || config.role}
                    </Badge>
                  )}
                </AccordionTrigger>
                <AccordionContent>
                  <BuilderTabs config={config} onUpdate={updateConfig} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="context" className="border rounded-lg px-3">
                <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                  <span className="flex items-center gap-2">
                    <LayoutIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    Context & Sources
                  </span>
                  {sourceCount > 0 && (
                    <Badge variant="secondary" className="ml-auto mr-2 text-[10px]">
                      {sourceCount}
                    </Badge>
                  )}
                </AccordionTrigger>
                <AccordionContent>
                  <ContextPanel
                    contextConfig={config.contextConfig}
                    onUpdateSources={updateContextSources}
                    onUpdateDatabaseConnections={updateDatabaseConnections}
                    onUpdateRag={updateRagParameters}
                    onUpdateStructured={updateContextStructured}
                    onUpdateInterview={updateContextInterview}
                    onUpdateProjectNotes={updateProjectNotes}
                    onToggleDelimiters={toggleDelimiters}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="tone" className="border rounded-lg px-3">
                <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                    Tone & Style
                  </span>
                  {config.tone && (
                    <Badge variant="secondary" className="ml-auto mr-2 text-[10px]">
                      {config.tone}
                    </Badge>
                  )}
                </AccordionTrigger>
                <AccordionContent>
                  <ToneControls
                    tone={config.tone}
                    complexity={config.complexity}
                    onUpdate={updateConfig}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="quality" className="border rounded-lg px-3">
                <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                  <span className="flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                    Quality Score
                  </span>
                  <Badge
                    variant={score.total >= 75 ? "default" : "secondary"}
                    className="ml-auto mr-2 text-[10px]"
                  >
                    {score.total}/100
                  </Badge>
                </AccordionTrigger>
                <AccordionContent>
                  <QualityScore score={score} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Right: Output — inline on desktop, drawer on mobile */}
          {!isMobile && (
            <div className="lg:sticky lg:top-20 lg:self-start">
              <OutputPanel
                builtPrompt={builtPrompt}
                enhancedPrompt={enhancedPrompt}
                isEnhancing={isEnhancing}
                onEnhance={handleEnhance}
                onSaveVersion={saveVersion}
                onSaveTemplate={handleSaveAsTemplate}
                canSaveTemplate={canSaveTemplate}
              />
              <p className="text-xs text-muted-foreground text-center mt-3">
                Press <kbd className="px-1.5 py-0.5 text-[10px] bg-muted rounded border border-border font-mono">Ctrl+Enter</kbd> to enhance
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Mobile: sticky bottom bar */}
      {isMobile && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border px-4 py-3 flex gap-2">
          <Button
            variant="glow"
            size="default"
            onClick={handleEnhance}
            disabled={isEnhancing || !builtPrompt}
            className="flex-1 gap-2"
          >
            {isEnhancing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enhancing…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Enhance
              </>
            )}
          </Button>
          {displayPrompt && (
            <Button
              variant="outline"
              size="default"
              onClick={() => setDrawerOpen(true)}
              className="gap-1.5"
            >
              <Eye className="w-4 h-4" />
              Output
            </Button>
          )}
        </div>
      )}

      {/* Mobile: output drawer */}
      {isMobile && (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>
                {enhancedPrompt ? "✨ Enhanced Prompt" : "📝 Preview"}
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6 overflow-auto flex-1">
              <OutputPanel
                builtPrompt={builtPrompt}
                enhancedPrompt={enhancedPrompt}
                isEnhancing={isEnhancing}
                onEnhance={handleEnhance}
                onSaveVersion={saveVersion}
                onSaveTemplate={handleSaveAsTemplate}
                canSaveTemplate={canSaveTemplate}
                hideEnhanceButton
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Add bottom padding on mobile for sticky bar */}
      {isMobile && <div className="h-20" />}

      <Suspense fallback={null}>
        {templatesOpen && (
          <TemplateLibrary
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            savedTemplates={templateSummaries}
            onSelectPreset={handleSelectTemplate}
            onSelectSaved={handleSelectSavedTemplate}
            onDeleteSaved={handleDeleteSavedTemplate}
          />
        )}

        {historyOpen && (
          <VersionHistory
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            versions={versions}
            onRestore={(prompt) => {
              setEnhancedPrompt(prompt);
              toast({ title: "Version restored" });
            }}
          />
        )}
      </Suspense>
    </div>
  );
};

export default Index;
