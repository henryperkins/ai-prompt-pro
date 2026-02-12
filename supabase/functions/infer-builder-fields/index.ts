import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  applyRateLimit,
  getClientIp,
  jsonResponse,
  requireAuthenticatedUser,
  resolveCors,
} from "../_shared/security.ts";
import {
  chooseConstraints,
  chooseFormat,
  chooseLengthPreference,
  chooseRole,
  chooseTone,
  INFERENCE_FIELD_CONFIDENCE,
  INFERENCE_FIELD_LABELS,
  type InferenceField,
} from "../../../shared/builder-inference-heuristics.ts";

const MAX_PROMPT_CHARS = Number(Deno.env.get("MAX_INFERENCE_PROMPT_CHARS") || "12000");
const INFER_PER_MINUTE = Number(Deno.env.get("INFER_PER_MINUTE") || "15");
const INFER_PER_DAY = Number(Deno.env.get("INFER_PER_DAY") || "400");

type FieldOwnership = "ai" | "user" | "empty";
interface CurrentFieldsInput {
  role?: string;
  tone?: string;
  lengthPreference?: string;
  format?: string[];
  constraints?: string[];
}

function hasText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasListValue(values: string[] | undefined): boolean {
  return Array.isArray(values) && values.some((value) => hasText(value));
}

function isLockedToUser(lockMetadata: Record<string, FieldOwnership>, field: InferenceField): boolean {
  return lockMetadata[field] === "user";
}

function createSuggestionChip(field: InferenceField, updates: Record<string, unknown>) {
  return {
    id: `set-${field}`,
    label: INFERENCE_FIELD_LABELS[field],
    description: "Apply AI-inferred details",
    action: {
      type: "set_fields",
      updates,
      fields: [field],
    },
  };
}

serve(async (req) => {
  const cors = resolveCors(req);

  if (req.method === "OPTIONS") {
    if (!cors.ok) {
      return jsonResponse({ error: cors.error }, cors.status, cors.headers);
    }
    return new Response("ok", { headers: cors.headers });
  }

  if (!cors.ok) {
    return jsonResponse({ error: cors.error }, cors.status, cors.headers);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, cors.headers);
  }

  try {
    const auth = await requireAuthenticatedUser(req);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error }, auth.status, cors.headers);
    }

    const clientIp = getClientIp(req);
    const minuteLimit = await applyRateLimit({
      scope: "infer-minute",
      key: `${auth.userId}:${clientIp}`,
      limit: INFER_PER_MINUTE,
      windowMs: 60_000,
    });
    if (!minuteLimit.ok) {
      return jsonResponse(
        { error: "Rate limit exceeded. Please try again later." },
        429,
        cors.headers,
        {
          "Retry-After": String(minuteLimit.retryAfterSeconds),
        },
      );
    }

    const dailyKey = auth.isAnonymous ? `${auth.userId}:${clientIp}` : auth.userId;
    const dailyLimit = await applyRateLimit({
      scope: "infer-day",
      key: dailyKey,
      limit: INFER_PER_DAY,
      windowMs: 86_400_000,
    });
    if (!dailyLimit.ok) {
      return jsonResponse(
        { error: "Daily quota exceeded. Please try again tomorrow." },
        429,
        cors.headers,
        {
          "Retry-After": String(dailyLimit.retryAfterSeconds),
        },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400, cors.headers);
    }

    const promptRaw = (body as { prompt?: unknown })?.prompt;
    const prompt = typeof promptRaw === "string" ? promptRaw.trim() : "";
    if (!prompt) {
      return jsonResponse({ error: "Prompt is required." }, 400, cors.headers);
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return jsonResponse(
        { error: `Prompt is too large. Maximum ${MAX_PROMPT_CHARS} characters.` },
        413,
        cors.headers,
      );
    }

    const currentFieldsRaw = (body as { current_fields?: unknown; currentFields?: unknown })?.current_fields
      ?? (body as { current_fields?: unknown; currentFields?: unknown })?.currentFields;
    const currentFields: CurrentFieldsInput =
      currentFieldsRaw && typeof currentFieldsRaw === "object" && !Array.isArray(currentFieldsRaw)
        ? (currentFieldsRaw as CurrentFieldsInput)
        : {};

    const lockMetadataRaw = (body as { lock_metadata?: unknown; lockMetadata?: unknown })?.lock_metadata
      ?? (body as { lock_metadata?: unknown; lockMetadata?: unknown })?.lockMetadata;
    const lockMetadata: Record<string, FieldOwnership> =
      lockMetadataRaw && typeof lockMetadataRaw === "object" && !Array.isArray(lockMetadataRaw)
        ? (lockMetadataRaw as Record<string, FieldOwnership>)
        : {};

    const normalizedPrompt = prompt.toLowerCase();
    const inferredUpdates: Record<string, unknown> = {};
    const inferredFields: InferenceField[] = [];
    const suggestionChips: Array<Record<string, unknown>> = [];
    const confidence: Record<string, number> = {};

    const role = chooseRole(normalizedPrompt);
    if (role && !hasText(currentFields.role) && !isLockedToUser(lockMetadata, "role")) {
      inferredUpdates.role = role;
      inferredFields.push("role");
      suggestionChips.push(createSuggestionChip("role", { role }));
      confidence.role = INFERENCE_FIELD_CONFIDENCE.role;
    }

    const tone = chooseTone(normalizedPrompt);
    if (tone && !hasText(currentFields.tone) && !isLockedToUser(lockMetadata, "tone")) {
      inferredUpdates.tone = tone;
      inferredFields.push("tone");
      suggestionChips.push(createSuggestionChip("tone", { tone }));
      confidence.tone = INFERENCE_FIELD_CONFIDENCE.tone;
    }

    const lengthPreference = chooseLengthPreference(normalizedPrompt);
    if (
      lengthPreference &&
      !hasText(currentFields.lengthPreference) &&
      !isLockedToUser(lockMetadata, "lengthPreference")
    ) {
      inferredUpdates.lengthPreference = lengthPreference;
      inferredFields.push("lengthPreference");
      suggestionChips.push(createSuggestionChip("lengthPreference", { lengthPreference }));
      confidence.lengthPreference = INFERENCE_FIELD_CONFIDENCE.lengthPreference;
    }

    const format = chooseFormat(normalizedPrompt);
    if (format.length > 0 && !hasListValue(currentFields.format) && !isLockedToUser(lockMetadata, "format")) {
      inferredUpdates.format = format;
      inferredFields.push("format");
      suggestionChips.push(createSuggestionChip("format", { format }));
      confidence.format = INFERENCE_FIELD_CONFIDENCE.format;
    }

    const constraints = chooseConstraints(normalizedPrompt);
    if (
      constraints.length > 0 &&
      !hasListValue(currentFields.constraints) &&
      !isLockedToUser(lockMetadata, "constraints")
    ) {
      inferredUpdates.constraints = constraints;
      inferredFields.push("constraints");
      suggestionChips.push(createSuggestionChip("constraints", { constraints }));
      confidence.constraints = INFERENCE_FIELD_CONFIDENCE.constraints;
    }

    if (suggestionChips.length === 0 && normalizedPrompt.length > 20) {
      suggestionChips.push({
        id: "append-audience",
        label: "Add audience details",
        description: "Append audience and success criteria hints.",
        action: {
          type: "append_prompt",
          text: "\nAudience: [who this is for]\nDesired outcome: [what success looks like]",
        },
      });
    }

    return jsonResponse(
      {
        inferredUpdates,
        inferredFields,
        suggestionChips,
        confidence,
      },
      200,
      cors.headers,
    );
  } catch (error) {
    console.error("infer-builder-fields error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
      cors.headers,
    );
  }
});
