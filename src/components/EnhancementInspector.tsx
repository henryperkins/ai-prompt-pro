import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/card";
import type { EnhanceMetadata } from "@/lib/enhance-metadata";
import type { EnhancementPlan } from "@/lib/enhancement-plan";
import { trackBuilderEvent } from "@/lib/telemetry";

interface EnhancementInspectorProps {
  metadata: EnhanceMetadata;
  onApplyToBuilder?: (updates: ApplyToBuilderUpdate) => void;
}

export interface ApplyToBuilderUpdate {
  role?: string;
  context?: string;
  format?: string;
  constraints?: string;
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
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {onApply && (
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            className="h-5 px-1.5 text-[10px]"
            onClick={() => {
              onApply({ [fieldKey]: value });
              trackBuilderEvent("builder_enhance_assumption_edited", { field: fieldKey });
            }}
          >
            Apply to builder
          </Button>
        )}
      </div>
      <p className="text-xs text-foreground/80 leading-relaxed">{value}</p>
    </div>
  );
}

function PlanSection({ plan }: { plan: EnhancementPlan }) {
  return (
    <div className="space-y-1.5 border-t border-border/40 pt-2">
      <p className="text-xs font-medium text-muted-foreground">Enhancement plan</p>
      {plan.target_deliverable && (
        <p className="text-xs text-foreground/80">
          <span className="text-muted-foreground">Deliverable:</span> {plan.target_deliverable}
        </p>
      )}
      {plan.audience && (
        <p className="text-xs text-foreground/80">
          <span className="text-muted-foreground">Audience:</span> {plan.audience}
        </p>
      )}
      {plan.success_criteria.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Success criteria:</p>
          <ul className="space-y-0.5">
            {plan.success_criteria.map((c, i) => (
              <li key={i} className="text-xs text-foreground/80 pl-3 relative before:content-['✓'] before:absolute before:left-0 before:text-success-primary">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {plan.verification_needs.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Verification needs:</p>
          <ul className="space-y-0.5">
            {plan.verification_needs.map((v, i) => (
              <li key={i} className="text-xs text-foreground/80 pl-3 relative before:content-['!'] before:absolute before:left-0 before:text-warning-primary">
                {v}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function EnhancementInspector({ metadata, onApplyToBuilder }: EnhancementInspectorProps) {
  const parts = metadata.partsBreakdown;
  const plan = metadata.enhancementPlan;

  if (!parts && !plan) return null;

  const handleApplyAll = () => {
    if (!parts || !onApplyToBuilder) return;
    const updates: ApplyToBuilderUpdate = {};
    if (parts.role) updates.role = parts.role;
    if (parts.context) updates.context = parts.context;
    if (parts.output_format) updates.format = parts.output_format;
    if (parts.guardrails) updates.constraints = parts.guardrails;
    onApplyToBuilder(updates);
    trackBuilderEvent("builder_enhance_assumption_edited", { action: "apply_all" });
  };

  return (
    <Card className="p-3 space-y-2 border-border/50 bg-muted/20">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">Structured breakdown</p>
        {onApplyToBuilder && parts && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleApplyAll}
          >
            Apply all to builder
          </Button>
        )}
      </div>

      {parts && (
        <div className="space-y-2">
          <InspectorSection label="Role" value={parts.role} fieldKey="role" onApply={onApplyToBuilder} />
          <InspectorSection label="Context" value={parts.context} fieldKey="context" onApply={onApplyToBuilder} />
          <InspectorSection label="Output format" value={parts.output_format} fieldKey="format" onApply={onApplyToBuilder} />
          <InspectorSection label="Guardrails" value={parts.guardrails} fieldKey="constraints" onApply={onApplyToBuilder} />
        </div>
      )}

      {plan && <PlanSection plan={plan} />}
    </Card>
  );
}
