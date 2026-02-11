import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { loadPost, loadProfilesByIds } from "@/lib/community";
import { consumeRestoredVersionPrompt } from "@/lib/history-restore";
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
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
      title={meta.label}
    >
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">{meta.label}</span>
    </span>
  );
}

type BuilderSection = "builder" | "context" | "tone" | "quality";

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openSections, setOpenSections] = useState<BuilderSection[]>(["builder"]);
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
    saveVersion,
    savePrompt,
    saveAndSharePrompt,
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
    const restoredPrompt = consumeRestoredVersionPrompt();
    if (!restoredPrompt) return;
    setEnhancedPrompt(restoredPrompt);
    toast({ title: "Version restored", description: "Restored from History." });
    if (isMobile) {
      setDrawerOpen(true);
    }
  }, [isMobile, setEnhancedPrompt, toast]);

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
  const mobilePreviewText = useMemo(() => {
    const trimmed = displayPrompt.trim();
    if (!trimmed) {
      return "Your prompt preview updates as you build. Tap to expand.";
    }
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join("\n");
  }, [displayPrompt]);
  const refineSuggestions = useMemo(() => {
    const suggestions: Array<{ id: BuilderSection; title: string; description: string }> = [];
    if (sectionHealth.builder !== "complete") {
      suggestions.push({
        id: "builder",
        title: selectedRole ? "Add task details" : "Add a role",
        description: "Clarify who the model should be and what outcome you need.",
      });
    }
    if (sectionHealth.context !== "complete") {
      suggestions.push({
        id: "context",
        title: "Add context",
        description: "Include sources, notes, or constraints from your environment.",
      });
    }
    if (sectionHealth.tone !== "complete") {
      suggestions.push({
        id: "tone",
        title: "Tune tone",
        description: "Set style and complexity to better match the target audience.",
      });
    }
    return suggestions.slice(0, 3);
  }, [sectionHealth.builder, sectionHealth.context, sectionHealth.tone, selectedRole]);
  const showRefineSuggestions = Boolean(enhancedPrompt.trim()) && refineSuggestions.length > 0;
  const openAndFocusSection = useCallback((section: BuilderSection) => {
    setOpenSections((prev) => (prev.includes(section) ? prev : [...prev, section]));
    window.requestAnimationFrame(() => {
      document.getElementById(`accordion-${section}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
      />

      <main className="flex-1 container mx-auto px-4 py-3 sm:py-6">
        {/* Hero — compact on mobile */}
        <div className="delight-hero-static text-center mb-4 sm:mb-8">
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
                <p className="text-[11px] uppercase tracking-wide text-primary">Remix mode</p>
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

            <Card className="border-border/70 bg-card/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-foreground">Enhance first, refine after</p>
                  <p className="text-[11px] text-muted-foreground">
                    Start with a rough prompt, run Enhance, then apply targeted improvements.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={handleEnhance}
                  disabled={isEnhancing || !builtPrompt}
                >
                  {isEnhancing ? "Enhancing..." : "Enhance now"}
                </Button>
              </div>
            </Card>

            {showRefineSuggestions && (
              <Card className="border-primary/25 bg-primary/5 p-3">
                <p className="text-xs font-medium text-primary">Improve this result</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {refineSuggestions.map((suggestion) => (
                    <Button
                      key={suggestion.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => openAndFocusSection(suggestion.id)}
                    >
                      {suggestion.title}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {refineSuggestions[0]?.description}
                </p>
              </Card>
            )}

            {/* Accordion sections */}
            <Accordion
              type="multiple"
              value={openSections}
              onValueChange={(value) => setOpenSections(value as BuilderSection[])}
              className="space-y-1"
            >
              <AccordionItem id="accordion-builder" value="builder" className="border rounded-lg px-3">
                <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                  <span className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-muted-foreground" />
                    Builder
                  </span>
                  <span className="ml-auto mr-2 flex items-center gap-1.5">
                    {selectedRole && (
                      <Badge variant="secondary" className="max-w-[120px] truncate text-[11px]">
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

              <AccordionItem id="accordion-context" value="context" className="border rounded-lg px-3">
                <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                  <span className="flex items-center gap-2">
                    <LayoutIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    Context & Sources
                  </span>
                  <span className="ml-auto mr-2 flex items-center gap-1.5">
                    {sourceCount > 0 && (
                      <Badge variant="secondary" className="text-[11px]">
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

              <AccordionItem id="accordion-tone" value="tone" className="border rounded-lg px-3">
                <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                    Tone & Style
                  </span>
                  <span className="ml-auto mr-2 flex items-center gap-1.5">
                    {config.tone && (
                      <Badge variant="secondary" className="text-[11px]">
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

              <AccordionItem id="accordion-quality" value="quality" className="border rounded-lg px-3">
                <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                  <span className="flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                    Quality Score
                  </span>
                  <span className="ml-auto mr-2 flex items-center gap-1.5">
                    <Badge
                      variant={score.total >= 75 ? "default" : "secondary"}
                      className="text-[11px]"
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
                Press <kbd className="px-1.5 py-0.5 text-[11px] bg-muted rounded border border-border font-mono">Ctrl+Enter</kbd> to enhance
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Mobile: sticky bottom bar */}
      {isMobile && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="interactive-chip mb-2 w-full rounded-lg border border-border/80 bg-background/70 px-3 py-2 text-left"
            aria-label="Open output preview"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              Live preview
            </div>
            <p className="mt-1 max-h-10 overflow-hidden whitespace-pre-line font-mono text-[11px] leading-5 text-foreground/90">
              {mobilePreviewText}
            </p>
          </button>

          <div className="flex items-center gap-2">
            <Badge
              variant={score.total >= 75 ? "default" : "secondary"}
              className="h-10 min-w-[64px] justify-center rounded-md px-2 text-[11px] font-semibold"
            >
              {score.total}/100
            </Badge>
            <Button
              variant="glow"
              size="default"
              onClick={handleEnhance}
              disabled={isEnhancing || !builtPrompt}
              className="signature-enhance-button h-10 flex-1 gap-2"
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
          </div>
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
      {isMobile && <div className="h-32" />}
    </div>
  );
};

export default Index;
