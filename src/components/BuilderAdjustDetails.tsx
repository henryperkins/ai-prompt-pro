import { useState, type ReactNode } from "react";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/card";
import { Checkbox } from "@/components/base/checkbox";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/label";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea";
import type { BuilderFieldOwnershipMap } from "@/lib/builder-inference";
import {
  PromptConfig,
  complexityOptions,
  constraintOptions,
  formatOptions,
  lengthChipOptions,
  normalizeConstraintSelections,
  roles,
  toneOptions,
} from "@/lib/prompt-builder";
import { cx } from "@/lib/utils/cx";
import {
  CaretDown as ChevronDown,
  CaretRight as ChevronRight,
  Sliders as SlidersHorizontal,
} from "@phosphor-icons/react";

type AdjustDetailsGroupKey = "persona" | "output" | "constraints" | "examples";

const defaultOpenGroups: Record<AdjustDetailsGroupKey, boolean> = {
  persona: true,
  output: false,
  constraints: false,
  examples: false,
};

interface AdjustDetailsGroupProps {
  id: string;
  title: string;
  summary: string;
  isOpen: boolean;
  onToggle: () => void;
  aiSuggested?: boolean;
  children: ReactNode;
}

function AdjustDetailsGroup({
  id,
  title,
  summary,
  isOpen,
  onToggle,
  aiSuggested = false,
  children,
}: AdjustDetailsGroupProps) {
  const sectionId = `builder-zone-2-${id}`;
  const titleId = `${sectionId}-title`;
  const summaryId = `${sectionId}-summary`;
  const contentId = `${sectionId}-content`;

  return (
    <section
      className={cx(
        "overflow-hidden rounded-xl border border-border/70 bg-background/40",
        isOpen && "bg-background/60",
      )}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left sm:px-4"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        aria-labelledby={titleId}
        aria-describedby={summaryId}
        data-testid={`builder-adjust-group-${id}-toggle`}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p id={titleId} className="text-sm font-medium text-foreground">
              {title}
            </p>
            {aiSuggested && (
              <Badge
                variant="pill"
                tone="brand"
                className="text-[10px] px-1.5 py-0"
              >
                AI
              </Badge>
            )}
          </div>
          <p
            id={summaryId}
            className="line-clamp-2 text-xs text-muted-foreground"
          >
            {summary}
          </p>
        </div>
        {isOpen ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div
          id={contentId}
          className="space-y-4 border-t border-border/70 px-3 pb-3 pt-3 sm:px-4"
          data-testid={`builder-adjust-group-${id}-content`}
        >
          {children}
        </div>
      )}
    </section>
  );
}

interface BuilderAdjustDetailsProps {
  config: PromptConfig;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (updates: Partial<PromptConfig>) => void;
  fieldOwnership?: BuilderFieldOwnershipMap;
}

export function BuilderAdjustDetails({
  config,
  isOpen,
  onOpenChange,
  onUpdate,
  fieldOwnership,
}: BuilderAdjustDetailsProps) {
  const [openGroups, setOpenGroups] =
    useState<Record<AdjustDetailsGroupKey, boolean>>(defaultOpenGroups);
  const selectedRole = config.customRole || config.role;
  const formatCount =
    config.format.length + (config.customFormat.trim() ? 1 : 0);
  const constraintCount =
    config.constraints.length + (config.customConstraint.trim() ? 1 : 0);
  const selectedLength =
    lengthChipOptions.find((option) => option.value === config.lengthPreference)
      ?.label ?? "Standard";

  const aiTag = (field: string) =>
    fieldOwnership?.[field as keyof BuilderFieldOwnershipMap] === "ai" ? (
      <Badge
        variant="pill"
        tone="brand"
        className="ml-1.5 text-[10px] px-1.5 py-0"
      >
        AI
      </Badge>
    ) : null;

  const groupHasAi = (...fields: Array<keyof BuilderFieldOwnershipMap>) =>
    fields.some((field) => fieldOwnership?.[field] === "ai");

  const toggleGroup = (group: AdjustDetailsGroupKey) => {
    setOpenGroups((current) => ({
      ...current,
      [group]: !current[group],
    }));
  };

  const personaSummary = [
    selectedRole || "No role selected",
    config.tone ? `${config.tone} tone` : "Model decides tone",
  ].join(" · ");

  const outputSummaryParts = [`${selectedLength} length`];
  if (formatCount > 0) {
    outputSummaryParts.unshift(
      `${formatCount} format${formatCount === 1 ? "" : "s"}`,
    );
  } else {
    outputSummaryParts.unshift("No format selected");
  }
  outputSummaryParts.push(
    config.complexity
      ? `${config.complexity} complexity`
      : "Model decides complexity",
  );
  const outputSummary = outputSummaryParts.join(" · ");

  const constraintsSummary =
    constraintCount > 0
      ? `${constraintCount} guardrail${constraintCount === 1 ? "" : "s"} active`
      : "No guardrails yet";
  const examplesSummary = config.examples.trim()
    ? "Reference example added"
    : "Optional example output";

  const toggleFormat = (format: string) => {
    const next = config.format.includes(format)
      ? config.format.filter((entry) => entry !== format)
      : [...config.format, format];
    onUpdate({ format: next });
  };

  const toggleConstraint = (constraint: string) => {
    const next = config.constraints.includes(constraint)
      ? config.constraints.filter((entry) => entry !== constraint)
      : [...config.constraints, constraint];
    onUpdate({ constraints: normalizeConstraintSelections(next) });
  };

  return (
    <Card
      id="builder-zone-2"
      className="border-border/70 bg-card/80 p-3 sm:p-4"
    >
      <div className="space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => onOpenChange(!isOpen)}
          aria-expanded={isOpen}
          aria-controls="builder-zone-2-content"
          aria-label="Adjust details"
        >
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              Adjust details
            </p>
            <p className="text-sm text-muted-foreground" aria-hidden="true">
              Role, style, format, and constraints.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedRole && (
              <Badge variant="modern" className="max-w-[180px] text-xs">
                <span className="type-wrap-safe">{selectedRole}</span>
              </Badge>
            )}
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {!isOpen && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {(() => {
              const parts: string[] = [];
              if (selectedRole) parts.push(selectedRole);
              if (config.tone) parts.push(`${config.tone} tone`);
              if (
                config.lengthPreference &&
                config.lengthPreference !== "standard"
              ) {
                parts.push(
                  config.lengthPreference.charAt(0).toUpperCase() +
                  config.lengthPreference.slice(1),
                );
              }
              if (formatCount > 0)
                parts.push(
                  `${formatCount} format${formatCount === 1 ? "" : "s"}`,
                );
              if (constraintCount > 0)
                parts.push(
                  `${constraintCount} constraint${constraintCount === 1 ? "" : "s"}`,
                );
              if (config.examples.trim()) parts.push("has examples");
              if (config.complexity)
                parts.push(`${config.complexity} complexity`);
              if (parts.length === 0) return "No details configured yet.";
              const hasAi =
                fieldOwnership &&
                Object.values(fieldOwnership).some((v) => v === "ai");
              return parts.join(", ") + (hasAi ? " (AI-suggested)" : "");
            })()}
          </p>
        )}

        {isOpen && (
          <div
            id="builder-zone-2-content"
            className="space-y-3 border-t border-border pt-3"
          >
            <AdjustDetailsGroup
              id="persona"
              title="Role and voice"
              summary={personaSummary}
              isOpen={openGroups.persona}
              onToggle={() => toggleGroup("persona")}
              aiSuggested={groupHasAi("role", "tone")}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    AI persona{aiTag("role")}
                  </Label>
                  <Select
                    selectedKey={config.role || undefined}
                    onSelectionChange={(value) => {
                      if (value !== null) {
                        onUpdate({ role: String(value), customRole: "" });
                      }
                    }}
                    placeholder="Select a role"
                    aria-label="Select role"
                    className="bg-background"
                  >
                    {roles.map((role) => (
                      <Select.Item key={role} id={role}>
                        {role}
                      </Select.Item>
                    ))}
                  </Select>
                  <p className="text-xs text-center text-muted-foreground">
                    or
                  </p>
                  <Input
                    value={config.customRole}
                    onChange={(value) =>
                      onUpdate({
                        customRole: value,
                        role: value ? "" : config.role,
                      })
                    }
                    placeholder="Or use a custom role"
                    wrapperClassName="bg-background"
                    aria-label="Custom role"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    Tone{aiTag("tone")}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={config.tone === "" ? "primary" : "secondary"}
                      className="h-11 px-2 text-sm sm:h-9"
                      onClick={() => onUpdate({ tone: "" })}
                      aria-label="Let model decide tone"
                      aria-pressed={config.tone === ""}
                    >
                      Model decides
                    </Button>
                    {toneOptions.map((tone) => (
                      <Button
                        key={tone}
                        type="button"
                        size="sm"
                        variant={config.tone === tone ? "primary" : "secondary"}
                        className="h-11 px-2 text-sm sm:h-9"
                        onClick={() => onUpdate({ tone })}
                        aria-pressed={config.tone === tone}
                      >
                        {tone}
                      </Button>
                    ))}
                  </div>
                  {!config.tone && (
                    <p className="text-xs text-muted-foreground">
                      No tone selected — the model will decide.
                    </p>
                  )}
                </div>
              </div>
            </AdjustDetailsGroup>

            <AdjustDetailsGroup
              id="output"
              title="Output shape"
              summary={outputSummary}
              isOpen={openGroups.output}
              onToggle={() => toggleGroup("output")}
              aiSuggested={groupHasAi("format", "lengthPreference")}
            >
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Output format{aiTag("format")}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {formatOptions.map((format) => (
                    <Button
                      key={format}
                      type="button"
                      size="sm"
                      variant={
                        config.format.includes(format) ? "primary" : "secondary"
                      }
                      className="h-11 px-2 text-sm sm:h-9"
                      onClick={() => toggleFormat(format)}
                      aria-pressed={config.format.includes(format)}
                    >
                      {format}
                    </Button>
                  ))}
                </div>
                <Input
                  value={config.customFormat}
                  onChange={(value) => onUpdate({ customFormat: value })}
                  placeholder="Custom format"
                  wrapperClassName="bg-background"
                  aria-label="Custom format"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Length{aiTag("lengthPreference")}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {lengthChipOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={
                        config.lengthPreference === option.value
                          ? "primary"
                          : "secondary"
                      }
                      className="h-auto px-2.5 py-1.5 text-left"
                      onClick={() =>
                        onUpdate({ lengthPreference: option.value })
                      }
                      aria-pressed={config.lengthPreference === option.value}
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm">{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Complexity
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      config.complexity === "" ? "primary" : "secondary"
                    }
                    className="h-11 px-2 text-sm sm:h-9"
                    onClick={() => onUpdate({ complexity: "" })}
                    aria-label="Let model decide complexity"
                    aria-pressed={config.complexity === ""}
                  >
                    Model decides
                  </Button>
                  {complexityOptions.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      size="sm"
                      variant={
                        config.complexity === option ? "primary" : "secondary"
                      }
                      className="h-11 px-2 text-sm sm:h-9"
                      onClick={() => onUpdate({ complexity: option })}
                      aria-pressed={config.complexity === option}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
                {!config.complexity && (
                  <p className="text-xs text-muted-foreground">
                    No complexity selected — the model will decide.
                  </p>
                )}
              </div>
            </AdjustDetailsGroup>

            <AdjustDetailsGroup
              id="constraints"
              title="Constraints"
              summary={constraintsSummary}
              isOpen={openGroups.constraints}
              onToggle={() => toggleGroup("constraints")}
              aiSuggested={groupHasAi("constraints")}
            >
              <div className="space-y-3">
                <Label className="text-sm font-medium text-foreground">
                  Constraints{aiTag("constraints")}
                </Label>
                <div className="space-y-2">
                  {constraintOptions.map((constraint) => {
                    return (
                      <Checkbox
                        key={constraint}
                        isSelected={config.constraints.includes(constraint)}
                        onChange={() => toggleConstraint(constraint)}
                        label={constraint}
                        size="sm"
                      />
                    );
                  })}
                </div>
                <Input
                  value={config.customConstraint}
                  onChange={(value) => onUpdate({ customConstraint: value })}
                  placeholder="Custom constraint"
                  wrapperClassName="bg-background"
                  aria-label="Custom constraint"
                />
              </div>
            </AdjustDetailsGroup>

            <AdjustDetailsGroup
              id="examples"
              title="Examples"
              summary={examplesSummary}
              isOpen={openGroups.examples}
              onToggle={() => toggleGroup("examples")}
            >
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Example output (optional)
                </Label>
                <TextArea
                  value={config.examples}
                  onChange={(value) => onUpdate({ examples: value })}
                  placeholder="Include sample inputs/outputs for better fidelity"
                  aria-label="Example output"
                  textAreaClassName="min-h-[100px] bg-background font-mono"
                />
              </div>
            </AdjustDetailsGroup>
          </div>
        )}
      </div>
    </Card>
  );
}
