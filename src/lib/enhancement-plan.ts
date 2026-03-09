/**
 * Frontend type for the canonical enhancement plan returned by the backend.
 * Added in Task 7 — the model produces a structured plan alongside the
 * enhanced prompt so the UI can surface it for inspection and editing.
 */

export interface EnhancementPlan {
  primary_intent: string;
  source_task_type: string;
  target_deliverable: string;
  audience: string;
  required_inputs: string[];
  constraints: string[];
  success_criteria: string[];
  assumptions: string[];
  open_questions: string[];
  verification_needs: string[];
}

export function parseEnhancementPlan(raw: unknown): EnhancementPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const primaryIntent = typeof obj.primary_intent === "string" ? obj.primary_intent : "";
  if (!primaryIntent) return null;

  return {
    primary_intent: primaryIntent,
    source_task_type: typeof obj.source_task_type === "string" ? obj.source_task_type : "",
    target_deliverable: typeof obj.target_deliverable === "string" ? obj.target_deliverable : "",
    audience: typeof obj.audience === "string" ? obj.audience : "",
    required_inputs: safeStringArray(obj.required_inputs),
    constraints: safeStringArray(obj.constraints),
    success_criteria: safeStringArray(obj.success_criteria),
    assumptions: safeStringArray(obj.assumptions),
    open_questions: safeStringArray(obj.open_questions),
    verification_needs: safeStringArray(obj.verification_needs),
  };
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
