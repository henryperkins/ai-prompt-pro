import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Sparkles, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OutputPanelProps {
  builtPrompt: string;
  enhancedPrompt: string;
  isEnhancing: boolean;
  onEnhance: () => void;
  onSaveVersion: () => void;
}

export function OutputPanel({
  builtPrompt,
  enhancedPrompt,
  isEnhancing,
  onEnhance,
  onSaveVersion,
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const displayPrompt = enhancedPrompt || builtPrompt;

  const handleCopy = async () => {
    if (!displayPrompt) return;
    await navigator.clipboard.writeText(displayPrompt);
    setCopied(true);
    toast({ title: "Copied to clipboard!", description: "Paste it into your favorite AI tool." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">
          {enhancedPrompt ? "✨ Enhanced Prompt" : "📝 Preview"}
        </h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onSaveVersion} disabled={!displayPrompt} className="gap-1 text-xs">
            <Save className="w-3 h-3" />
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!displayPrompt} className="gap-1 text-xs">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <Card className="flex-1 p-4 bg-card border-border overflow-auto">
        {displayPrompt ? (
          <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed">
            {displayPrompt}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <p className="text-sm text-muted-foreground text-center">
              Your enhanced prompt will appear here.
              <br />
              Start by entering a prompt or choosing a template.
            </p>
          </div>
        )}
      </Card>

      <Button
        variant="glow"
        size="lg"
        onClick={onEnhance}
        disabled={isEnhancing || !builtPrompt}
        className="w-full gap-2"
      >
        {isEnhancing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Enhancing...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Enhance with AI
          </>
        )}
      </Button>
    </div>
  );
}
