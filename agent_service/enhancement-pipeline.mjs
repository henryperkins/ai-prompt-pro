const BUILDER_MODES = new Set(["quick", "guided", "advanced"]);

const INTENT_PATTERNS = {
  creative: /\b(write|create|generate|story|poem|design|draft|compose|brainstorm)\b/i,
  analytical: /\b(analyze|analyse|compare|evaluate|assess|review|benchmark)\b/i,
  instructional: /\b(how to|steps?|guide|tutorial|explain|walkthrough)\b/i,
  conversational: /\b(chat|talk|discuss|roleplay|act as)\b/i,
  extraction: /\b(extract|summari[sz]e|list|find|identify|pull out)\b/i,
  coding: /\b(code|function|script|debug|implement|build|refactor|api)\b/i,
  reasoning: /\b(why|reason|logic|argue|prove|think)\b/i,
};

const DOMAIN_PATTERNS = {
  technical: /\b(api|database|server|deploy|algorithm|code|infra|architecture)\b/i,
  business: /\b(revenue|strategy|market|customer|kpi|roi|sales|gtm)\b/i,
  academic: /\b(research|thesis|study|hypothesis|literature|paper)\b/i,
  creative: /\b(story|character|plot|design|art|music|novel)\b/i,
  health: /\b(medical|health|fitness|nutrition|therapy|wellness)\b/i,
  legal: /\b(law|regulation|compliance|contract|liability|statute)\b/i,
  education: /\b(teach|learn|curriculum|student|lesson|pedagogy)\b/i,
};

const MODE_ADDONS = {
  quick: [
    "## MODE: QUICK",
    "- Keep the enhanced prompt under 200 words.",
    "- Focus primarily on Role, Task, and Output format.",
    "- Skip examples unless critical for task correctness.",
    "- Prioritize clarity over comprehensiveness.",
  ].join("\n"),
  guided: [
    "## MODE: GUIDED",
    "- Use all 6 parts with concise, practical detail.",
    "- Include one example when useful.",
    "- Target 200-500 words for the enhanced prompt.",
    "- Balance structure and readability.",
  ].join("\n"),
  advanced: [
    "## MODE: ADVANCED",
    "- Use all 6 parts with full detail.",
    "- Include 1-2 examples where useful.",
    "- Add explicit edge-case handling instructions.",
    "- Target 400-800 words for the enhanced prompt.",
    "- Include a short pre-answer checklist for reasoning-heavy tasks.",
  ].join("\n"),
};

const INTENT_ADDONS = {
  coding: [
    "## CODING-SPECIFIC ENHANCEMENTS",
    "- Specify language, framework, and relevant versions.",
    "- Request robust error handling and validation.",
    "- Ask for concise comments only where needed.",
    "- Include tests or usage examples.",
    "- Include edge cases and failure handling expectations.",
  ].join("\n"),
  creative: [
    "## CREATIVE-SPECIFIC ENHANCEMENTS",
    "- Define tone, mood, and voice clearly.",
    "- Specify audience and desired emotional impact.",
    "- Set creative boundaries and avoid-list topics if needed.",
    "- Prioritize originality and sensory specificity.",
  ].join("\n"),
  analytical: [
    "## ANALYSIS-SPECIFIC ENHANCEMENTS",
    "- Request a clear analysis framework (for example: pros/cons, SWOT, matrix).",
    "- Require evidence-backed conclusions and explicit assumptions.",
    "- Call out limitations, uncertainty, and missing data.",
  ].join("\n"),
  reasoning: [
    "## REASONING-SPECIFIC ENHANCEMENTS",
    "- Ask for a concise, explicit step-by-step rationale.",
    "- Include competing perspectives and counterarguments when relevant.",
    "- Require clear separation between assumptions and conclusions.",
  ].join("\n"),
};

const REQUIRED_PARTS = ["role", "context", "task", "output_format", "guardrails"];
const BUILDER_FIELD_KEYS = ["role", "context", "task", "output_format", "examples", "guardrails"];
const DEFAULT_PARTS = {
  role: "",
  context: "",
  task: "",
  output_format: "",
  examples: null,
  guardrails: "",
};

const MASTER_META_PROMPT = [
  "You are PromptArchitect, an expert prompt engineer specializing in high-quality prompts for Large Language Models.",
  "",
  "## YOUR TASK",
  "Transform the user's raw input into an enhanced, production-ready prompt using the 6-Part Builder Framework.",
  "",
  "## USER'S RAW INPUT",
  "\"\"\"",
  "{{USER_INPUT}}",
  "\"\"\"",
  "",
  "## DETECTED CONTEXT",
  "- Intent Type: {{INTENT_TYPE}}",
  "- Domain: {{DOMAIN}}",
  "- Complexity Level: {{COMPLEXITY}} / 5",
  "- Builder Mode: {{BUILDER_MODE}}",
  "- Input Language: {{INPUT_LANGUAGE}}",
  "- Prompt Structure Present: {{PRESENT_SECTIONS}}",
  "- Prompt Structure Missing: {{MISSING_SECTIONS}}",
  "",
  "## BUILDER FIELD SNAPSHOT",
  "These are direct UI fields and may be empty. Use them as first-priority signals before inferring.",
  "{{BUILDER_FIELDS}}",
  "",
  "## 6-PART BUILDER FRAMEWORK",
  "Use all parts. If details are missing, infer minimal practical defaults.",
  "",
  "### Part 1: ROLE & PERSONA",
  "- Define who the AI should be.",
  "- Include domain-relevant expertise and communication style.",
  "",
  "### Part 2: CONTEXT & BACKGROUND",
  "- Clarify the user situation and task boundaries.",
  "- Include constraints and assumptions.",
  "",
  "### Part 3: TASK & INSTRUCTIONS",
  "- State the exact task with action verbs.",
  "- Break complex tasks into numbered steps.",
  "",
  "### Part 4: OUTPUT FORMAT & STRUCTURE",
  "- Define response structure, format, and target length.",
  "",
  "### Part 5: EXAMPLES & REFERENCE",
  "- Include 1-2 examples when beneficial.",
  "- If examples do not fit, provide a concise quality reference.",
  "",
  "### Part 6: GUARDRAILS & CONSTRAINTS",
  "- Define what to do and what to avoid.",
  "- Include fallback behavior for uncertainty.",
  "",
  "## ENHANCEMENT RULES",
  "1. Replace vague language with specific, actionable wording.",
  "2. Preserve user intent; improve quality without changing objective.",
  "3. Match terminology and rigor to domain: {{DOMAIN}}.",
  "4. Match detail level to complexity: {{COMPLEXITY}}.",
  "5. Keep the enhanced prompt in the same language as the input unless the user asked otherwise.",
  "6. If web search was used, include a trailing sources block in enhanced_prompt:",
  "   blank line + --- + Sources: + one '- [Title](URL)' per line.",
  "",
  "## EDGE CASE DIRECTIVES",
  "{{EDGE_CASE_NOTES}}",
  "",
  "## OUTPUT FORMAT",
  "Return ONLY valid JSON (no prose, no markdown fences) with this exact schema:",
  "{",
  "  \"enhanced_prompt\": \"string\",",
  "  \"parts_breakdown\": {",
  "    \"role\": \"string\",",
  "    \"context\": \"string\",",
  "    \"task\": \"string\",",
  "    \"output_format\": \"string\",",
  "    \"examples\": \"string|null\",",
  "    \"guardrails\": \"string\"",
  "  },",
  "  \"enhancements_made\": [\"string\"],",
  "  \"quality_score\": {",
  "    \"clarity\": 0,",
  "    \"specificity\": 0,",
  "    \"completeness\": 0,",
  "    \"actionability\": 0,",
  "    \"overall\": 0",
  "  },",
  "  \"suggestions\": [\"string\"],",
  "  \"alternative_versions\": {",
  "    \"shorter\": \"string\",",
  "    \"more_detailed\": \"string\"",
  "  }",
  "}",
].join("\n");

const CORE_SECTIONS = ["Role", "Task", "Context", "Format", "Constraints"];

function asWords(input) {
  if (typeof input !== "string") return [];
  return input.trim().split(/\s+/).filter(Boolean);
}

function clampNumber(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function normalizeBuilderMode(rawMode) {
  if (typeof rawMode !== "string") return "guided";
  const normalized = rawMode.trim().toLowerCase();
  return BUILDER_MODES.has(normalized) ? normalized : "guided";
}

function normalizeFieldValue(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function normalizeBuilderFields(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return {
    role: normalizeFieldValue(source.role),
    context: normalizeFieldValue(source.context),
    task: normalizeFieldValue(source.task),
    output_format: normalizeFieldValue(source.output_format ?? source.outputFormat),
    examples: normalizeFieldValue(source.examples),
    guardrails: normalizeFieldValue(source.guardrails),
  };
}

function detectInputLanguage(input) {
  const value = typeof input === "string" ? input : "";
  if (!value) return "unknown";
  if (/[\u4E00-\u9FFF\u3040-\u30FF]/.test(value)) return "cjk";
  if (/[\u0400-\u04FF]/.test(value)) return "cyrillic";
  if (/[\u0600-\u06FF]/.test(value)) return "arabic";
  if (/[\u0900-\u097F]/.test(value)) return "devanagari";
  return "english-or-latin";
}

function hasContradictoryLengthSignals(input) {
  const normalized = input.toLowerCase();
  const asksShort = /\b(short|brief|concise|tl;dr)\b/.test(normalized);
  const asksLong = /\b(detailed|comprehensive|thorough|deep dive|exhaustive)\b/.test(normalized);
  return asksShort && asksLong;
}

function hasMultipleTaskSignals(input) {
  const normalized = input.toLowerCase();
  return (
    /\b(and|also|then|plus|as well as)\b/.test(normalized)
    || /\b(first|second|third|next|after that)\b/.test(normalized)
    || /\bmultiple|several\b/.test(normalized)
  );
}

export function classifyIntent(input) {
  return Object.entries(INTENT_PATTERNS)
    .filter(([, regex]) => regex.test(input))
    .map(([intent]) => intent);
}

export function detectDomain(input) {
  return Object.entries(DOMAIN_PATTERNS)
    .filter(([, regex]) => regex.test(input))
    .map(([domain]) => domain);
}

export function scoreComplexity(input) {
  let score = 1;
  if (input.length > 100) score += 1;
  if (input.length > 300) score += 1;
  if (/\b(and|also|then|plus)\b/i.test(input)) score += 1;
  if (/\b(multiple|several|complex|detailed|comprehensive|end-to-end)\b/i.test(input)) score += 1;
  return clampNumber(score, 1, 5);
}

export function inspectPromptStructure(prompt) {
  const normalized = prompt.toLowerCase();
  function hasSection(name) {
    const token = name.toLowerCase();
    return [
      `${token}:`,
      `${token} -`,
      `## ${token}`,
      `### ${token}`,
      `[${token}]`,
    ].some((pattern) => normalized.includes(pattern));
  }
  const presentSections = CORE_SECTIONS.filter(hasSection);
  const missingSections = CORE_SECTIONS.filter((section) => !presentSections.includes(section));
  return {
    presentSections,
    missingSections,
    charCount: prompt.length,
  };
}

export function detectEnhancementContext(input, options = {}) {
  const prompt = typeof input === "string" ? input.trim() : "";
  const words = asWords(prompt);
  const intent = classifyIntent(prompt);
  const domain = detectDomain(prompt);
  const complexity = scoreComplexity(prompt);
  const structure = inspectPromptStructure(prompt);
  const builderMode = normalizeBuilderMode(options.builderMode);
  const inputLanguage = detectInputLanguage(prompt);
  const builderFields = normalizeBuilderFields(options.builderFields);

  return {
    intent,
    domain,
    complexity,
    builderMode,
    inputLanguage,
    wordCount: words.length,
    hasMultipleTasks: hasMultipleTaskSignals(prompt),
    hasContradiction: hasContradictoryLengthSignals(prompt),
    isTooVague: words.length > 0 && words.length < 5,
    structure,
    builderFields,
  };
}

function joinOrDefault(values, fallback) {
  return values.length > 0 ? values.join(", ") : fallback;
}

function buildEdgeCaseNotes(context) {
  const notes = [];
  if (context.isTooVague) {
    notes.push("- Input is very brief. Add practical assumptions and include a short suggestion to add context.");
  }
  if (context.hasMultipleTasks) {
    notes.push("- Multiple tasks are likely. Separate primary and secondary tasks in the enhanced prompt.");
  }
  if (context.hasContradiction) {
    notes.push("- Contradictory detail-level signals detected. Resolve with a practical balance and note the tradeoff.");
  }
  if (notes.length === 0) {
    notes.push("- No special edge-case constraints detected. Apply standard quality improvements.");
  }
  return notes.join("\n");
}

export function buildEnhancementMetaPrompt(userInput, context) {
  const modeAddon = MODE_ADDONS[context.builderMode] || MODE_ADDONS.guided;
  const intentAddons = context.intent
    .map((intent) => INTENT_ADDONS[intent])
    .filter((value) => typeof value === "string" && value.length > 0);

  const edgeCaseNotes = buildEdgeCaseNotes(context);
  const builderFieldLines = BUILDER_FIELD_KEYS.map((key) => {
    const value = context.builderFields?.[key] ?? "";
    return `- ${key}: ${value || "(empty)"}`;
  }).join("\n");
  const template = MASTER_META_PROMPT
    .replaceAll("{{USER_INPUT}}", userInput)
    .replaceAll("{{INTENT_TYPE}}", joinOrDefault(context.intent, "general"))
    .replaceAll("{{DOMAIN}}", joinOrDefault(context.domain, "general"))
    .replaceAll("{{COMPLEXITY}}", String(context.complexity))
    .replaceAll("{{BUILDER_MODE}}", context.builderMode)
    .replaceAll("{{INPUT_LANGUAGE}}", context.inputLanguage)
    .replaceAll(
      "{{PRESENT_SECTIONS}}",
      joinOrDefault(context.structure.presentSections, "none"),
    )
    .replaceAll(
      "{{MISSING_SECTIONS}}",
      joinOrDefault(context.structure.missingSections, "none"),
    )
    .replaceAll("{{BUILDER_FIELDS}}", builderFieldLines)
    .replaceAll("{{EDGE_CASE_NOTES}}", edgeCaseNotes);

  return [template, modeAddon, ...intentAddons].join("\n\n");
}

function stripCodeFence(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (!fenced) return text;
  return fenced[1].trim();
}

function extractJsonCandidate(text) {
  const normalized = stripCodeFence(text).trim();
  if (!normalized) return null;
  if (normalized.startsWith("{") && normalized.endsWith("}")) return normalized;
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return normalized.slice(start, end + 1);
}

export function parseEnhancementJsonResponse(rawText) {
  if (typeof rawText !== "string") return null;
  const candidate = extractJsonCandidate(rawText);
  if (!candidate) return null;
  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizePartsBreakdown(value, enhancedPrompt) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const output = { ...DEFAULT_PARTS };
  for (const key of Object.keys(DEFAULT_PARTS)) {
    const raw = source[key];
    if (key === "examples") {
      output.examples = typeof raw === "string" ? raw.trim() : null;
    } else if (typeof raw === "string") {
      output[key] = raw.trim();
    }
  }

  if (!output.role) output.role = "Role inferred from user objective and domain.";
  if (!output.context) output.context = "Context inferred from the source prompt and constraints.";
  if (!output.task) output.task = "Task clarified and broken into executable instructions.";
  if (!output.output_format) output.output_format = "Explicit output structure and length guidance.";
  if (!output.guardrails) output.guardrails = "Safety, quality, and uncertainty handling requirements.";
  if (!output.examples && enhancedPrompt.length > 0) {
    output.examples = null;
  }
  return output;
}

function normalizeQualityScore(value, fallbackOverall) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const clarity = clampNumber(source.clarity, 0, 10);
  const specificity = clampNumber(source.specificity, 0, 10);
  const completeness = clampNumber(source.completeness, 0, 10);
  const actionability = clampNumber(source.actionability, 0, 10);

  const average = Number(
    ((clarity + specificity + completeness + actionability) / 4).toFixed(1),
  );
  const overall = clampNumber(source.overall, 0, 10);

  if (overall > 0) {
    return { clarity, specificity, completeness, actionability, overall };
  }
  return { clarity, specificity, completeness, actionability, overall: fallbackOverall || average };
}

function normalizeAlternatives(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    shorter: typeof source.shorter === "string" ? source.shorter.trim() : "",
    more_detailed: typeof source.more_detailed === "string" ? source.more_detailed.trim() : "",
  };
}

function countWords(text) {
  return asWords(text).length;
}

export function scorePromptQuality(input) {
  let score = 2;
  const words = countWords(input);
  if (words > 20) score += 1;
  if (words > 50) score += 1;
  if (/\b(you are|act as|role)\b/i.test(input)) score += 1;
  if (/\b(step|first|then|next)\b/i.test(input)) score += 1;
  if (/\b(format|structure|output)\b/i.test(input)) score += 1;
  if (/\b(don't|avoid|must not|do not)\b/i.test(input)) score += 1;
  if (/\b(example|e\.g\.|such as)\b/i.test(input)) score += 1;
  if (/\d+/.test(input)) score += 0.5;
  return clampNumber(Math.round(score), 0, 10);
}

export function postProcessEnhancementResponse({
  llmResponseText,
  userInput,
  context,
}) {
  const originalPrompt = typeof userInput === "string" ? userInput.trim() : "";
  const rawResponse = typeof llmResponseText === "string" ? llmResponseText.trim() : "";
  const parsed = parseEnhancementJsonResponse(rawResponse);
  const originalScore = scorePromptQuality(originalPrompt);

  const fallbackEnhancedPrompt = rawResponse;
  const normalizedEnhancedPrompt = parsed && typeof parsed.enhanced_prompt === "string"
    ? parsed.enhanced_prompt.trim()
    : fallbackEnhancedPrompt;

  const parsedParts = parsed?.parts_breakdown && typeof parsed.parts_breakdown === "object"
    && !Array.isArray(parsed.parts_breakdown)
    ? parsed.parts_breakdown
    : {};
  const inferredEnhancedScore = Math.max(scorePromptQuality(normalizedEnhancedPrompt), originalScore);
  const partsBreakdown = normalizePartsBreakdown(parsed?.parts_breakdown, normalizedEnhancedPrompt);
  const qualityScore = normalizeQualityScore(parsed?.quality_score, inferredEnhancedScore);
  const missingParts = REQUIRED_PARTS.filter((part) => {
    const value = parsedParts[part];
    return !(typeof value === "string" && value.trim().length > 0);
  });
  const enhancementDelta = Number((qualityScore.overall - originalScore).toFixed(1));
  const safeEnhancements = normalizeStringList(parsed?.enhancements_made);
  const safeSuggestions = normalizeStringList(parsed?.suggestions);
  const alternatives = normalizeAlternatives(parsed?.alternative_versions);

  return {
    enhanced_prompt: normalizedEnhancedPrompt,
    parts_breakdown: partsBreakdown,
    enhancements_made: safeEnhancements,
    quality_score: qualityScore,
    suggestions: safeSuggestions,
    alternative_versions: alternatives,
    improvement_delta: enhancementDelta,
    missing_parts: missingParts,
    word_count: {
      original: countWords(originalPrompt),
      enhanced: countWords(normalizedEnhancedPrompt),
    },
    timestamp: new Date().toISOString(),
    detected_context: {
      intent: context.intent,
      domain: context.domain,
      complexity: context.complexity,
      mode: context.builderMode,
      input_language: context.inputLanguage,
    },
    builder_fields: context.builderFields,
    parse_status: parsed ? "json" : "fallback",
  };
}

export function pickPrimaryAgentMessageText(messagesByItemId, itemOrder) {
  const ordered = Array.isArray(itemOrder) ? itemOrder : [];
  const messageMap = messagesByItemId instanceof Map ? messagesByItemId : new Map();
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const itemId = ordered[i];
    const candidate = messageMap.get(itemId);
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  let longest = "";
  for (const value of messageMap.values()) {
    if (typeof value === "string" && value.trim().length > longest.length) {
      longest = value.trim();
    }
  }
  return longest;
}

export function parseEnhancementRequestMode(body) {
  if (!body || typeof body !== "object") return "guided";
  const directMode = typeof body.builder_mode === "string" ? body.builder_mode : body.builderMode;
  return normalizeBuilderMode(directMode);
}

export function parseEnhancementRequestBuilderFields(body) {
  if (!body || typeof body !== "object") {
    return normalizeBuilderFields({});
  }
  const raw = body.builder_fields ?? body.builderFields;
  return normalizeBuilderFields(raw);
}
