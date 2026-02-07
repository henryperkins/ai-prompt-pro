import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { PromptInput } from "@/components/PromptInput";
import { BuilderTabs } from "@/components/BuilderTabs";
import { ToneControls } from "@/components/ToneControls";
import { QualityScore } from "@/components/QualityScore";
import { OutputPanel } from "@/components/OutputPanel";
import { TemplateLibrary } from "@/components/TemplateLibrary";
import { VersionHistory } from "@/components/VersionHistory";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import { streamEnhance } from "@/lib/ai-client";
import { useToast } from "@/hooks/use-toast";
import type { PromptTemplate } from "@/lib/templates";
import { Separator } from "@/components/ui/separator";

const Index = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { toast } = useToast();

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
  } = usePromptBuilder();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const handleEnhance = useCallback(() => {
    if (!builtPrompt || isEnhancing) return;
    setIsEnhancing(true);
    setEnhancedPrompt("");

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
  }, [builtPrompt, isEnhancing, setIsEnhancing, setEnhancedPrompt, toast]);

  const handleSelectTemplate = useCallback(
    (template: PromptTemplate) => {
      loadTemplate(template);
      toast({ title: `Template loaded: ${template.name}` });
    },
    [loadTemplate, toast]
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      <main className="flex-1 container mx-auto px-4 py-6">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 tracking-tight">
            Transform Basic Prompts into
            <span className="text-primary"> Pro-Level Instructions</span>
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto">
            Build structured, effective prompts that get better AI results—every time.
            No prompt engineering expertise required.
          </p>
        </div>

        {/* Split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Input & Builder */}
          <div className="space-y-6">
            <PromptInput
              value={config.originalPrompt}
              onChange={(v) => updateConfig({ originalPrompt: v, task: v })}
              onReset={resetConfig}
            />

            <Separator />

            <BuilderTabs config={config} onUpdate={updateConfig} />

            <Separator />

            <ToneControls
              tone={config.tone}
              complexity={config.complexity}
              onUpdate={updateConfig}
            />

            <QualityScore score={score} />
          </div>

          {/* Right: Output */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <OutputPanel
              builtPrompt={builtPrompt}
              enhancedPrompt={enhancedPrompt}
              isEnhancing={isEnhancing}
              onEnhance={handleEnhance}
              onSaveVersion={saveVersion}
            />
            <p className="text-xs text-muted-foreground text-center mt-3">
              Press <kbd className="px-1.5 py-0.5 text-[10px] bg-muted rounded border border-border font-mono">Ctrl+Enter</kbd> to enhance
            </p>
          </div>
        </div>
      </main>

      <TemplateLibrary
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSelect={handleSelectTemplate}
      />

      <VersionHistory
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        versions={versions}
        onRestore={(prompt) => {
          setEnhancedPrompt(prompt);
          toast({ title: "Version restored" });
        }}
      />
    </div>
  );
};

export default Index;
