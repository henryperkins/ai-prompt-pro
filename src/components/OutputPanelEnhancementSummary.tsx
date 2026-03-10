import { Button } from "@/components/base/buttons/button";
import type { EnhanceMetadata } from "@/lib/enhance-metadata";
import type { EnhancementVariant } from "@/components/output-panel-types";

function formatModeLabel(mode: string | undefined): string | null {
  if (!mode) return null;

  const labels: Record<string, string> = {
    quick: "Light polish",
    guided: "Structured rewrite",
    advanced: "Expert prompt",
  };

  return labels[mode] ?? mode;
}

interface OutputPanelEnhancementSummaryProps {
  metadata: EnhanceMetadata;
  activeVariant: EnhancementVariant;
  onVariantChange: (variant: EnhancementVariant) => void;
  collapseOpenQuestions?: boolean;
}

export function OutputPanelEnhancementSummary({
  metadata,
  activeVariant,
  onVariantChange,
  collapseOpenQuestions,
}: OutputPanelEnhancementSummaryProps) {
  const ctx = metadata.detectedContext;
  const modeLabel = formatModeLabel(ctx?.mode);
  const hasDetected = Boolean(ctx && (ctx.intent.length > 0 || ctx.domain.length > 0));
  const hasChanges = Boolean(
    metadata.enhancementsMade && metadata.enhancementsMade.length > 0,
  );
  const hasMissing = Boolean(metadata.missingParts && metadata.missingParts.length > 0);
  const hasSuggestions = Boolean(metadata.suggestions && metadata.suggestions.length > 0);
  const hasVariants = Boolean(
    metadata.alternativeVersions &&
      (metadata.alternativeVersions.shorter ||
        metadata.alternativeVersions.more_detailed),
  );
  const hasAssumptions = Boolean(
    metadata.assumptionsMade && metadata.assumptionsMade.length > 0,
  );
  const hasQuestions = Boolean(
    metadata.openQuestions && metadata.openQuestions.length > 0,
  );

  if (
    !hasDetected &&
    !hasChanges &&
    !hasMissing &&
    !hasSuggestions &&
    !hasVariants &&
    !hasAssumptions &&
    !hasQuestions
  ) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 space-y-2 text-sm">
      {hasDetected && ctx && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Detected:</span>
          {ctx.primaryIntent && (
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {ctx.primaryIntent}
            </span>
          )}
          {(ctx.primaryIntent
            ? ctx.intent.filter((intent) => intent !== ctx.primaryIntent)
            : ctx.intent
          ).map((intent) => (
            <span
              key={intent}
              className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {intent}
            </span>
          ))}
          {ctx.domain.map((domain) => (
            <span
              key={domain}
              className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {domain}
            </span>
          ))}
          {ctx.complexity > 0 && (
            <span className="text-xs text-muted-foreground">
              complexity {ctx.complexity}/5
            </span>
          )}
          {modeLabel && (
            <span className="text-xs text-muted-foreground">
              mode: {modeLabel}
            </span>
          )}
        </div>
      )}

      {hasChanges && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">What changed:</p>
          <ul className="space-y-0.5">
            {metadata.enhancementsMade?.map((change, index) => (
              <li
                key={`${change}-${index}`}
                className="text-xs text-foreground/80 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-muted-foreground"
              >
                {change}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasMissing && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Watch-outs:</p>
          <ul className="space-y-0.5">
            {metadata.missingParts?.map((part, index) => (
              <li
                key={`${part}-${index}`}
                className="text-xs text-warning-primary pl-3 relative before:content-['⚠'] before:absolute before:left-0"
              >
                Missing: {part}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasSuggestions && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Try next:</p>
          <ul className="space-y-0.5">
            {metadata.suggestions?.map((suggestion, index) => (
              <li
                key={`${suggestion}-${index}`}
                className="text-xs text-foreground/80 pl-3 relative before:content-['→'] before:absolute before:left-0 before:text-muted-foreground"
              >
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasAssumptions && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Assumptions made:</p>
          <ul className="space-y-0.5">
            {metadata.assumptionsMade?.map((assumption, index) => (
              <li
                key={`${assumption}-${index}`}
                className="text-xs text-foreground/80 pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-muted-foreground"
              >
                {assumption}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasQuestions && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Open questions:</p>
          {collapseOpenQuestions ? (
            <p className="text-xs text-foreground/80">
              {metadata.openQuestions?.length} clarification question(s) are shown above the prompt.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {metadata.openQuestions?.map((question, index) => (
                <li
                  key={`${question}-${index}`}
                  className="text-xs text-foreground/80 pl-3 relative before:content-['?'] before:absolute before:left-0 before:text-primary"
                >
                  {question}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasVariants && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
          <span className="text-xs font-medium text-muted-foreground">Versions:</span>
          <Button
            type="button"
            variant={activeVariant === "original" ? "primary" : "secondary"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onVariantChange("original")}
          >
            Original
          </Button>
          {metadata.alternativeVersions?.shorter && (
            <Button
              type="button"
              variant={activeVariant === "shorter" ? "primary" : "secondary"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onVariantChange("shorter")}
            >
              Use shorter
            </Button>
          )}
          {metadata.alternativeVersions?.more_detailed && (
            <Button
              type="button"
              variant={activeVariant === "more_detailed" ? "primary" : "secondary"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onVariantChange("more_detailed")}
            >
              Use more detailed
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
