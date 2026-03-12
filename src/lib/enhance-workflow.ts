export type EnhanceWorkflowStatus =
  | "pending"
  | "running"
  | "completed"
  | "skipped"
  | "failed";

export interface EnhanceWorkflowStep {
  stepId: string;
  order: number;
  label: string;
  status: EnhanceWorkflowStatus;
  detail?: string;
}

const VALID_STATUSES = new Set<EnhanceWorkflowStatus>([
  "pending",
  "running",
  "completed",
  "skipped",
  "failed",
]);

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOrder(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

export function parseEnhanceWorkflowStep(raw: unknown): EnhanceWorkflowStep | null {
  if (!raw || typeof raw !== "object") return null;

  const container = raw as { payload?: unknown };
  const source = (
    container.payload && typeof container.payload === "object"
      ? container.payload
      : raw
  ) as Record<string, unknown>;

  const stepId = asTrimmedString(source.step_id ?? source.stepId);
  const label = asTrimmedString(source.label);
  const status = asTrimmedString(source.status) as EnhanceWorkflowStatus | null;
  const order = normalizeOrder(source.order);

  if (!stepId || !label || !status || !VALID_STATUSES.has(status) || order === null) {
    return null;
  }

  return {
    stepId,
    order,
    label,
    status,
    detail: asTrimmedString(source.detail) ?? undefined,
  };
}

export function upsertEnhanceWorkflowStep(
  steps: EnhanceWorkflowStep[],
  nextStep: EnhanceWorkflowStep,
): EnhanceWorkflowStep[] {
  const existingIndex = steps.findIndex((step) => step.stepId === nextStep.stepId);
  const nextSteps = existingIndex === -1
    ? [...steps, nextStep]
    : steps.map((step, index) => (index === existingIndex ? { ...step, ...nextStep } : step));

  return nextSteps
    .slice()
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
}
