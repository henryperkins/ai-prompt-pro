import { lazy, Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { PromptInput } from "@/components/PromptInput";
import { BuilderTabs } from "@/components/BuilderTabs";
import { ContextPanel } from "@/components/ContextPanel";
import { ToneControls } from "@/components/ToneControls";
import { QualityScore } from "@/components/QualityScore";
import { OutputPanel, type EnhancePhase } from "@/components/OutputPanel";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import { streamEnhance } from "@/lib/ai-client";
import { getSectionHealth, type SectionHealthState } from "@/lib/section-health";
import { hasPromptInput } from "@/lib/prompt-builder";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PromptTemplate } from "@/lib/templates";
import type { PromptShareInput } from "@/lib/persistence";
import { loadPost, loadProfilesByIds } from "@/lib/community";
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
import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Loader2,
  Eye,
  Target,
  Layout as LayoutIcon,
  MessageSquare,
  BarChart3,
  Check,
  CircleDashed,
  Gauge,
  CheckCircle2,
  X,
} from "lucide-react";

const PromptLibrary = lazy(async () => {
  const module = await import("@/components/PromptLibrary");
  return { default: module.PromptLibrary };
});

const VersionHistory = lazy(async () => {
  const module = await import("@/components/VersionHistory");
  return { default: module.VersionHistory };
});

const healthBadgeStyles: Record<
  SectionHealthState,
  { label: string; className: string; icon: LucideIcon }
> = {
  empty: {
    label: "Empty",
    className: "border-border/80 bg-muted/50 text-muted-foreground",
    icon: CircleDashed,
  },
  in_progress: {
    label: "In progress",
    className: "border-primary/30 bg-primary/10 text-primary",
    icon: Gauge,
  },
  complete: {
    label: "Complete",
    className: "border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    icon: CheckCircle2,
  },
};

function SectionHealthBadge({ state }: { state: SectionHealthState }) {
  const meta = healthBadgeStyles[state];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.className}`}
      title={meta.label}
    >
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">{meta.label}</span>
    </span>
  );
}

const Index = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const remixId = searchParams.get("remix");
  const remixLoadToken = useRef(0);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [enhancePhase, setEnhancePhase] = useState<EnhancePhase>("idle");
  const enhancePhaseTimers = useRef<number[]>([]);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const {
    config,
    updateConfig,
    clearOriginalPrompt,
    builtPrompt,
    score,
    enhancedPrompt,
    setEnhancedPrompt,
    isEnhancing,
    setIsEnhancing,
    isSignedIn,
    versions,
    saveVersion,
    loadTemplate,
    savePrompt,
    saveAndSharePrompt,
    shareSavedPrompt,
    unshareSavedPrompt,
    loadSavedTemplate,
    deleteSavedTemplate,
    templateSummaries,
    remixContext,
    startRemix,
    clearRemix,
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

  useEffect(() => {
    if (!remixId) return;
    if (remixContext?.postId === remixId) return;
    const token = ++remixLoadToken.current;

    void (async () => {
      try {
        const post = await loadPost(remixId);
        if (token !== remixLoadToken.current) return;
        if (!post) {
          toast({ title: "Remix unavailable", description: "That community prompt could not be loaded." });
          return;
        }
        const [author] = await loadProfilesByIds([post.authorId]);
        if (token !== remixLoadToken.current) return;

        startRemix({
          postId: post.id,
          title: post.title,
          authorName: author?.displayName,
          publicConfig: post.publicConfig,
          parentTags: post.tags,
          parentCategory: post.category,
        });
        toast({ title: "Remix ready", description: `Loaded “${post.title}” into the builder.` });
      } catch (error) {
        if (token !== remixLoadToken.current) return;
        toast({
          title: "Failed to load remix",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    })();
  }, [remixId, remixContext?.postId, startRemix, toast]);

  const handleClearRemix = useCallback(() => {
    clearRemix();
    if (!remixId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("remix");
    setSearchParams(next, { replace: true });
  }, [clearRemix, remixId, searchParams, setSearchParams]);

  const clearEnhanceTimers = useCallback(() => {
    enhancePhaseTimers.current.forEach((timer) => window.clearTimeout(timer));
    enhancePhaseTimers.current = [];
  }, []);

  useEffect(() => {
    return () => clearEnhanceTimers();
  }, [clearEnhanceTimers]);

  const handleEnhance = useCallback(() => {
    if (!builtPrompt || isEnhancing) return;
    clearEnhanceTimers();
    setEnhancePhase("starting");
    setIsEnhancing(true);
    setEnhancedPrompt("");

    if (isMobile) setDrawerOpen(true);

    let accumulated = "";
    let hasReceivedDelta = false;
    streamEnhance({
      prompt: builtPrompt,
      onDelta: (text) => {
        if (!hasReceivedDelta) {
          hasReceivedDelta = true;
          setEnhancePhase("streaming");
        }
        accumulated += text;
        setEnhancedPrompt(accumulated);
      },
      onDone: () => {
        setIsEnhancing(false);
        setEnhancePhase("settling");
        const doneTimer = window.setTimeout(() => {
          setEnhancePhase("done");
        }, 260);
        const idleTimer = window.setTimeout(() => {
          setEnhancePhase("idle");
        }, 1800);
        enhancePhaseTimers.current.push(doneTimer, idleTimer);
        toast({ title: "Prompt enhanced!", description: "Your prompt has been optimized by AI." });
      },
      onError: (error) => {
        clearEnhanceTimers();
        setIsEnhancing(false);
        setEnhancePhase("idle");
        toast({ title: "Enhancement failed", description: error, variant: "destructive" });
      },
    });
  }, [builtPrompt, clearEnhanceTimers, isEnhancing, setIsEnhancing, setEnhancedPrompt, toast, isMobile]);

  useEffect(() => {
    if (isEnhancing) return;
    clearEnhanceTimers();
    setEnhancePhase("idle");
  }, [builtPrompt, clearEnhanceTimers, isEnhancing]);

  const handleSelectTemplate = useCallback(
    (template: PromptTemplate) => {
      loadTemplate(template);
      toast({ title: `Template loaded: ${template.name}` });
    },
    [loadTemplate, toast]
  );

  const handleSelectSavedTemplate = useCallback(
    async (id: string) => {
      try {
        const loaded = await loadSavedTemplate(id);
        if (!loaded) {
          toast({ title: "Prompt not found", variant: "destructive" });
          return;
        }
        toast({
          title: `Prompt loaded: ${loaded.record.metadata.name}`,
          description:
            loaded.warnings.length > 0
              ? `${loaded.warnings.length} context warning(s). Review integrations before running.`
              : "Prompt restored successfully.",
        });
      } catch (error) {
        toast({
          title: "Failed to load prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [loadSavedTemplate, toast]
  );

  const handleDeleteSavedTemplate = useCallback(
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
    [deleteSavedTemplate, toast]
  );

  const handleShareSavedPrompt = useCallback(
    async (id: string, input?: PromptShareInput) => {
      if (!isSignedIn) {
        toast({ title: "Sign in required", description: "Sign in to share prompts.", variant: "destructive" });
        return;
      }

      try {
        const shared = await shareSavedPrompt(id, input);
        if (!shared) {
          toast({ title: "Prompt not found", variant: "destructive" });
          return;
        }
        toast({ title: "Prompt shared to community" });
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

  const handleUnshareSavedPrompt = useCallback(
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
    [unshareSavedPrompt, toast],
  );

  const handleSavePrompt = useCallback(
    async (input: { name: string; description?: string; tags?: string[]; category?: string; remixNote?: string }) => {
      try {
        const result = await savePrompt({
          title: input.name,
          description: input.description,
          tags: input.tags,
          category: input.category,
          remixNote: input.remixNote,
        });
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
          title: `Prompt ${verb}: ${result.record.metadata.name}`,
          description: `Revision r${result.record.metadata.revision}.${warningText}`,
        });
        if (remixContext) {
          handleClearRemix();
        }
      } catch (error) {
        toast({
          title: "Failed to save prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [savePrompt, toast, remixContext, handleClearRemix]
  );

  const handleSaveAndSharePrompt = useCallback(
    async (input: {
      name: string;
      description?: string;
      tags?: string[];
      category?: string;
      useCase: string;
      targetModel?: string;
      remixNote?: string;
    }) => {
      if (!isSignedIn) {
        toast({ title: "Sign in required", description: "Sign in to share prompts.", variant: "destructive" });
        return;
      }

      try {
        const result = await saveAndSharePrompt({
          title: input.name,
          description: input.description,
          tags: input.tags,
          category: input.category,
          useCase: input.useCase,
          targetModel: input.targetModel,
          remixNote: input.remixNote,
        });
        toast({
          title: `Prompt shared: ${result.record.metadata.name}`,
          description: `Revision r${result.record.metadata.revision}.`,
        });
        if (remixContext) {
          handleClearRemix();
        }
      } catch (error) {
        toast({
          title: "Failed to save & share prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [isSignedIn, saveAndSharePrompt, toast, remixContext, handleClearRemix]
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
  const sectionHealth = getSectionHealth(config, score.total);
  const selectedRole = config.customRole || config.role;
  const displayPrompt = enhancedPrompt || builtPrompt;
  const canSavePrompt = hasPromptInput(config);
  const canSharePrompt = canSavePrompt && isSignedIn;
  const mobileEnhanceLabel = isEnhancing
    ? enhancePhase === "starting"
      ? "Starting…"
      : enhancePhase === "settling"
        ? "Finalizing…"
        : "Enhancing…"
    : enhancePhase === "done"
      ? "Enhanced"
      : "Enhance";

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
        <div className="delight-hero text-center mb-4 sm:mb-8">
          <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-foreground mb-1 sm:mb-2 tracking-tight">
            Transform Basic Prompts into
            <span className="text-primary"> Pro-Level Instructions</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm md:text-base max-w-xl mx-auto hidden sm:block">
            Build structured, effective prompts that get better AI results—every time.
            No prompt engineering expertise required.
          </p>
        </div>

        {remixContext && (
          <Card className="mb-4 border-primary/30 bg-primary/5 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-primary">Remix mode</p>
                <p className="text-sm font-medium text-foreground">
                  Remixing {remixContext.parentAuthor}’s “{remixContext.parentTitle}”
                </p>
                <p className="text-xs text-muted-foreground">
                  Your changes will be attributed when you save or share.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearRemix} className="gap-1 text-xs">
                <X className="h-3 w-3" />
                Clear remix
              </Button>
            </div>
          </Card>
        )}

        {/* Split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Left: Input & Builder — accordion on all sizes for consistency */}
          <div className="space-y-3 sm:space-y-4">
            {/* Prompt input always visible */}
            <PromptInput
              value={config.originalPrompt}
              onChange={(v) => updateConfig({ originalPrompt: v })}
              onClear={clearOriginalPrompt}
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
                  <span className="ml-auto mr-2 flex items-center gap-1.5">
                    {selectedRole && (
                      <Badge variant="secondary" className="max-w-[120px] truncate text-[10px]">
                        {selectedRole}
                      </Badge>
                    )}
                    <SectionHealthBadge state={sectionHealth.builder} />
                  </span>
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
                  <span className="ml-auto mr-2 flex items-center gap-1.5">
                    {sourceCount > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {sourceCount} src
                      </Badge>
                    )}
                    <SectionHealthBadge state={sectionHealth.context} />
                  </span>
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
                  <span className="ml-auto mr-2 flex items-center gap-1.5">
                    {config.tone && (
                      <Badge variant="secondary" className="text-[10px]">
                        {config.tone}
                      </Badge>
                    )}
                    <SectionHealthBadge state={sectionHealth.tone} />
                  </span>
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
                  <span className="ml-auto mr-2 flex items-center gap-1.5">
                    <Badge
                      variant={score.total >= 75 ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {score.total}/100
                    </Badge>
                    <SectionHealthBadge state={sectionHealth.quality} />
                  </span>
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
                enhancePhase={enhancePhase}
                onEnhance={handleEnhance}
                onSaveVersion={saveVersion}
                onSavePrompt={handleSavePrompt}
                onSaveAndSharePrompt={handleSaveAndSharePrompt}
                canSavePrompt={canSavePrompt}
                canSharePrompt={canSharePrompt}
                remixContext={
                  remixContext
                    ? { title: remixContext.parentTitle, authorName: remixContext.parentAuthor }
                    : undefined
                }
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
            className="signature-enhance-button flex-1 gap-2"
            data-phase={enhancePhase}
          >
            {isEnhancing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {mobileEnhanceLabel}
              </>
            ) : (
              <>
                {enhancePhase === "done" ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                {mobileEnhanceLabel}
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
                enhancePhase={enhancePhase}
                onEnhance={handleEnhance}
                onSaveVersion={saveVersion}
                onSavePrompt={handleSavePrompt}
                onSaveAndSharePrompt={handleSaveAndSharePrompt}
                canSavePrompt={canSavePrompt}
                canSharePrompt={canSharePrompt}
                hideEnhanceButton
                remixContext={
                  remixContext
                    ? { title: remixContext.parentTitle, authorName: remixContext.parentAuthor }
                    : undefined
                }
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Add bottom padding on mobile for sticky bar */}
      {isMobile && <div className="h-20" />}

      <Suspense fallback={null}>
        {templatesOpen && (
          <PromptLibrary
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            savedPrompts={templateSummaries}
            onSelectTemplate={handleSelectTemplate}
            onSelectSaved={handleSelectSavedTemplate}
            onDeleteSaved={handleDeleteSavedTemplate}
            onShareSaved={handleShareSavedPrompt}
            onUnshareSaved={handleUnshareSavedPrompt}
            canShareSavedPrompts={isSignedIn}
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
