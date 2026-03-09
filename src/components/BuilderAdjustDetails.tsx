import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/card";
import { Checkbox } from "@/components/base/checkbox";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/label";
import { Select } from "@/components/base/select/select";
import { Textarea } from "@/components/base/textarea";
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
import {
  CaretDown as ChevronDown,
  CaretRight as ChevronRight,
  Sliders as SlidersHorizontal,
} from "@phosphor-icons/react";

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
  const selectedRole = config.customRole || config.role;
  const formatCount =
    config.format.length + (config.customFormat.trim() ? 1 : 0);
  const constraintCount =
    config.constraints.length + (config.customConstraint.trim() ? 1 : 0);

  const aiTag = (field: string) =>
    fieldOwnership?.[field as keyof BuilderFieldOwnershipMap] === "ai" ? (
      <Badge
        color="brand"
        type="pill-color"
        className="ml-1.5 text-[10px] px-1.5 py-0"
      >
        AI
      </Badge>
    ) : null;

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
            className="space-y-5 border-t border-border pt-3"
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
                <p className="text-xs text-center text-muted-foreground">or</p>
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
                    className={`h-11 px-2 text-sm sm:h-9 ${config.tone === "" ? "ring-1 ring-primary/50" : ""}`}
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
                      className={`h-11 px-2 text-sm sm:h-9 ${config.tone === tone ? "ring-1 ring-primary/50" : ""}`}
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
                    className={`h-11 px-2 text-sm sm:h-9 ${config.format.includes(format) ? "ring-1 ring-primary/50" : ""}`}
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
                    className={`h-auto px-2.5 py-1.5 text-left ${config.lengthPreference === option.value ? "ring-1 ring-primary/50" : ""}`}
                    onClick={() => onUpdate({ lengthPreference: option.value })}
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
                  variant={config.complexity === "" ? "primary" : "secondary"}
                  className={`h-11 px-2 text-sm sm:h-9 ${config.complexity === "" ? "ring-1 ring-primary/50" : ""}`}
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
                    className={`h-11 px-2 text-sm sm:h-9 ${config.complexity === option ? "ring-1 ring-primary/50" : ""}`}
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

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Example output (optional)
              </Label>
              <Textarea
                value={config.examples}
                onChange={(e) => onUpdate({ examples: e.target.value })}
                placeholder="Include sample inputs/outputs for better fidelity"
                className="min-h-[100px] bg-background font-mono"
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
