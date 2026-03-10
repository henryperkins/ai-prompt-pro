import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/card";
import { EnhancementEditableList } from "@/components/EnhancementEditableList";
import type {
  EditableEnhancementListEdit,
  EditableEnhancementListField,
  EnhanceMetadata,
} from "@/lib/enhance-metadata";
import type { EnhancementPlan } from "@/lib/enhancement-plan";
import { trackBuilderEvent } from "@/lib/telemetry";

type InspectorOpenSection = "builder" | "context" | "tone" | "quality";

interface EnhancementInspectorProps {
  metadata: EnhanceMetadata;
  onApplyToBuilder?: (updates: ApplyToBuilderUpdate) => void;
  onApplyToSessionContext?: (label: string, content: string) => void;
  onCopyText?: (label: string, content: string) => void;
  onEditableListSaved?: (edit: EditableEnhancementListEdit) => void;
  onApplyEditableListToPrompt?: (
    field: EditableEnhancementListField,
    items: string[],
  ) => void;
}

export interface ApplyToBuilderUpdate {
  role?: string;
  context?: string;
  task?: string;
  format?: string;
  examples?: string;
  constraints?: string;
  openSections?: InspectorOpenSection[];
  action?: "apply_field" | "apply_all";
  sourceField?: string;
}

function joinTextBlocks(values: Array<string | null | undefined>): string {
  const unique = Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0),
    ),
  );
  return unique.join("\n");
}

function formatLabeledList(label: string, values: string[]): string {
  return [label, ...values.map((value, index) => `${index + 1}. ${value}`)].join("\n");
}

function trackStructuredApply(
  action: "apply_field" | "apply_all" | "copy" | "apply_to_context",
  field: string,
): void {
  trackBuilderEvent("builder_enhance_structured_applied", {
    action,
    field,
    source: "structured_inspector",
  });
}

function InspectorSection({
  label,
  value,
  fieldKey,
  onApply,
}: {
  label: string;
  value: string;
  fieldKey: keyof ApplyToBuilderUpdate;
  onApply?: (updates: ApplyToBuilderUpdate) => void;
}) {
  if (!value) return null;

  return (
    <div className="space-y-1.5 rounded-lg border border-border/50 bg-background/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {onApply && (
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => {
              onApply({
                [fieldKey]: value,
                openSections: ["builder"],
                action: "apply_field",
                sourceField: String(fieldKey),
              });
              trackStructuredApply("apply_field", String(fieldKey));
            }}
          >
            Apply to builder
          </Button>
        )}
      </div>
      <p className="text-xs leading-relaxed text-foreground/85 whitespace-pre-wrap">
        {value}
      </p>
    </div>
  );
}

function PlanSummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  if (!value) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-background/60 p-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-foreground/85">
        {value}
      </p>
    </div>
  );
}

function PlanListSection({
  label,
  values,
  onApplyToSessionContext,
  onCopyText,
}: {
  label: string;
  values: string[];
  onApplyToSessionContext?: (label: string, content: string) => void;
  onCopyText?: (label: string, content: string) => void;
}) {
  if (values.length === 0) return null;

  const content = formatLabeledList(label, values);

  return (
    <div className="space-y-2 rounded-lg border border-border/50 bg-background/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="flex flex-wrap gap-1.5">
          {onApplyToSessionContext && (
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => {
                onApplyToSessionContext(label, content);
                trackStructuredApply("apply_to_context", label);
              }}
            >
              Add to session context
            </Button>
          )}
          {onCopyText && (
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => {
                onCopyText(label, content);
                trackStructuredApply("copy", label);
              }}
            >
              Copy
            </Button>
          )}
        </div>
      </div>
      <ol className="space-y-1 pl-4 text-xs leading-relaxed text-foreground/85">
        {values.map((value, index) => (
          <li key={`${label}-${index}`} className="list-decimal">
            {value}
          </li>
        ))}
      </ol>
    </div>
  );
}

function PlanSection({
  plan,
  constraintText,
  onApplyToSessionContext,
  onCopyText,
  onEditableListSaved,
  onApplyEditableListToPrompt,
}: {
  plan: EnhancementPlan;
  constraintText: string;
  onApplyToSessionContext?: (label: string, content: string) => void;
  onCopyText?: (label: string, content: string) => void;
  onEditableListSaved?: (edit: EditableEnhancementListEdit) => void;
  onApplyEditableListToPrompt?: (
    field: EditableEnhancementListField,
    items: string[],
  ) => void;
}) {
  return (
    <div className="space-y-2 border-t border-border/40 pt-3">
      <p className="text-xs font-semibold text-muted-foreground">Plan details</p>

      <div className="grid gap-2 sm:grid-cols-2">
        <PlanSummaryRow label="Primary intent" value={plan.primary_intent} />
        <PlanSummaryRow label="Source task type" value={plan.source_task_type} />
        <PlanSummaryRow label="Deliverable" value={plan.target_deliverable} />
        <PlanSummaryRow label="Audience" value={plan.audience} />
      </div>

      <PlanListSection
        label="Required inputs"
        values={plan.required_inputs}
        onApplyToSessionContext={onApplyToSessionContext}
        onCopyText={onCopyText}
      />
      <PlanListSection
        label="Constraints"
        values={plan.constraints}
        onApplyToSessionContext={onApplyToSessionContext}
        onCopyText={onCopyText}
      />
      {!plan.constraints.length && constraintText ? (
        <PlanSummaryRow label="Constraints" value={constraintText} />
      ) : null}
      <PlanListSection
        label="Success criteria"
        values={plan.success_criteria}
        onApplyToSessionContext={onApplyToSessionContext}
        onCopyText={onCopyText}
      />
      <EnhancementEditableList
        field="plan_assumptions"
        label="Plan assumptions"
        items={plan.assumptions}
        onItemSaved={onEditableListSaved}
        onApplyToPrompt={onApplyEditableListToPrompt}
        onApplyToSessionContext={onApplyToSessionContext}
        onCopyText={onCopyText}
      />
      <EnhancementEditableList
        field="plan_open_questions"
        label="Plan open questions"
        items={plan.open_questions}
        onItemSaved={onEditableListSaved}
        onApplyToPrompt={onApplyEditableListToPrompt}
        onApplyToSessionContext={onApplyToSessionContext}
        onCopyText={onCopyText}
      />
      <PlanListSection
        label="Verification needs"
        values={plan.verification_needs}
        onApplyToSessionContext={onApplyToSessionContext}
        onCopyText={onCopyText}
      />
    </div>
  );
}

export function EnhancementInspector({
  metadata,
  onApplyToBuilder,
  onApplyToSessionContext,
  onCopyText,
  onEditableListSaved,
  onApplyEditableListToPrompt,
}: EnhancementInspectorProps) {
  const parts = metadata.partsBreakdown;
  const plan = metadata.enhancementPlan;
  const constraintText = joinTextBlocks([
    parts?.guardrails,
    ...(plan?.constraints ?? []),
  ]);
  const hasEditableMetadataLists = Boolean(
    (metadata.assumptionsMade?.length ?? 0) > 0 ||
      (metadata.openQuestions?.length ?? 0) > 0,
  );

  if (!parts && !plan && !hasEditableMetadataLists) return null;

  const handleApplyAll = () => {
    if (!parts || !onApplyToBuilder) return;

    const updates: ApplyToBuilderUpdate = {
      role: parts.role || undefined,
      context: parts.context || undefined,
      task: parts.task || undefined,
      format: parts.output_format || undefined,
      examples: parts.examples || undefined,
      constraints: constraintText || undefined,
      openSections: ["builder", "context"],
      action: "apply_all",
      sourceField: "all",
    };
    onApplyToBuilder(updates);
    trackStructuredApply("apply_all", "all");
  };

  return (
    <Card className="space-y-3 border-border/50 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground">
          Structured breakdown
        </p>
        {onApplyToBuilder && parts && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleApplyAll}
          >
            Apply all structured parts
          </Button>
        )}
      </div>

      {parts && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Apply to builder
          </p>
          <InspectorSection
            label="Role"
            value={parts.role}
            fieldKey="role"
            onApply={onApplyToBuilder}
          />
          <InspectorSection
            label="Context"
            value={parts.context}
            fieldKey="context"
            onApply={onApplyToBuilder}
          />
          <InspectorSection
            label="Task"
            value={parts.task}
            fieldKey="task"
            onApply={onApplyToBuilder}
          />
          <InspectorSection
            label="Output format"
            value={parts.output_format}
            fieldKey="format"
            onApply={onApplyToBuilder}
          />
          <InspectorSection
            label="Examples"
            value={parts.examples ?? ""}
            fieldKey="examples"
            onApply={onApplyToBuilder}
          />
          <InspectorSection
            label="Guardrails & constraints"
            value={constraintText}
            fieldKey="constraints"
            onApply={onApplyToBuilder}
          />
        </div>
      )}

      {hasEditableMetadataLists && (
        <div className="space-y-2 border-t border-border/40 pt-3">
          <p className="text-xs font-semibold text-muted-foreground">
            Review assumptions & questions
          </p>
          <EnhancementEditableList
            field="assumptions_made"
            label="Assumptions made"
            items={metadata.assumptionsMade ?? []}
            onItemSaved={onEditableListSaved}
            onApplyToPrompt={onApplyEditableListToPrompt}
            onApplyToSessionContext={onApplyToSessionContext}
            onCopyText={onCopyText}
          />
          <EnhancementEditableList
            field="open_questions"
            label="Open questions"
            items={metadata.openQuestions ?? []}
            onItemSaved={onEditableListSaved}
            onApplyToPrompt={onApplyEditableListToPrompt}
            onApplyToSessionContext={onApplyToSessionContext}
            onCopyText={onCopyText}
          />
        </div>
      )}

      {plan && (
        <PlanSection
          plan={plan}
          constraintText={constraintText}
          onApplyToSessionContext={onApplyToSessionContext}
          onCopyText={onCopyText}
          onEditableListSaved={onEditableListSaved}
          onApplyEditableListToPrompt={onApplyEditableListToPrompt}
        />
      )}
    </Card>
  );
}
