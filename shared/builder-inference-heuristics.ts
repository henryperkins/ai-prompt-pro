export type InferenceField = "role" | "tone" | "lengthPreference" | "format" | "constraints";

export const INFERENCE_FIELD_LABELS: Record<InferenceField, string> = {
  role: "Set AI persona",
  tone: "Adjust tone",
  lengthPreference: "Tune response length",
  format: "Choose output format",
  constraints: "Add guidance constraints",
};

/**
 * Base confidence per field — used as the starting point for per-match scoring.
 * When multiple keywords match for a single field, confidence increases via
 * `computeConfidence()`.
 */
export const INFERENCE_FIELD_CONFIDENCE: Record<InferenceField, number> = {
  role: 0.78,
  tone: 0.72,
  lengthPreference: 0.66,
  format: 0.7,
  constraints: 0.64,
};

const CONFIDENCE_PER_EXTRA_MATCH = 0.04;
const CONFIDENCE_CAP = 0.95;

/**
 * Compute confidence from a base value and the number of keyword matches.
 * Formula: base + 0.04 * (matchCount - 1), capped at 0.95.
 */
export function computeConfidence(base: number, matchCount: number): number {
  if (matchCount <= 0) return 0;
  const raw = base + CONFIDENCE_PER_EXTRA_MATCH * Math.max(matchCount - 1, 0);
  return Math.min(raw, CONFIDENCE_CAP);
}

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase();
}

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

/* ------------------------------------------------------------------ */
/*  Role detection                                                     */
/* ------------------------------------------------------------------ */

interface RoleMatch {
  role: string;
  pattern: RegExp;
}

const ROLE_PATTERNS: RoleMatch[] = [
  { role: "Software Developer", pattern: /\b(code|debug|refactor|typescript|javascript|react|python|api|backend|frontend|deploy|ci\/cd|git)\b/g },
  { role: "Data Analyst", pattern: /\b(analy[sz]e|dashboard|metrics|kpi|sql|cohort|forecast|data|visualization|pivot)\b/g },
  { role: "Expert Copywriter", pattern: /\b(email|announcement|campaign|copy|headline|landing page|tagline|ad|slogan)\b/g },
  { role: "Teacher", pattern: /\b(lesson|teach|syllabus|quiz|curriculum|student|classroom|assignment)\b/g },
  { role: "Support Specialist", pattern: /\b(support|ticket|customer|helpdesk|escalation|sla|troubleshoot|incident)\b/g },
  { role: "Product Strategist", pattern: /\b(roadmap|prioriti[sz]e|feature|prd|product|strategy|backlog|user story|okr)\b/g },
  { role: "Research Analyst", pattern: /\b(synthesis|literature|findings|systematic review|meta-analysis|research paper|methodology)\b/g },
  { role: "Executive Communicator", pattern: /\b(board|investor|stakeholder|executive summary|quarterly|shareholder|c-suite)\b/g },
  { role: "Prompt Engineer", pattern: /\b(evaluate|critique|review prompt|assess|grade|prompt quality|scoring rubric|meta-prompt)\b/g },
];

export interface RoleInference {
  role: string;
  matchCount: number;
  confidence: number;
}

export function chooseRole(prompt: string): string | null {
  const result = chooseRoleWithConfidence(prompt);
  return result?.role ?? null;
}

export function chooseRoleWithConfidence(prompt: string): RoleInference | null {
  const normalized = normalizePrompt(prompt);
  let best: RoleInference | null = null;

  for (const { role, pattern } of ROLE_PATTERNS) {
    const matches = countMatches(normalized, new RegExp(pattern.source, "g"));
    if (matches > 0) {
      const confidence = computeConfidence(INFERENCE_FIELD_CONFIDENCE.role, matches);
      if (!best || matches > best.matchCount) {
        best = { role, matchCount: matches, confidence };
      }
    }
  }

  return best;
}

/* ------------------------------------------------------------------ */
/*  Tone detection                                                     */
/* ------------------------------------------------------------------ */

interface ToneMatch {
  tone: string;
  pattern: RegExp;
}

const TONE_PATTERNS: ToneMatch[] = [
  { tone: "Casual", pattern: /\b(friendly|casual|informal|conversational|relaxed)\b/g },
  { tone: "Technical", pattern: /\b(technical|architecture|spec|implementation|engineering)\b/g },
  { tone: "Creative", pattern: /\b(creative|story|brainstorm|campaign|imaginative)\b/g },
  { tone: "Academic", pattern: /\b(academic|citation|research|scholarly|peer-reviewed)\b/g },
  { tone: "Professional", pattern: /\b(executive|stakeholder|board|client|formal|polished)\b/g },
];

export interface ToneInference {
  tone: string;
  matchCount: number;
  confidence: number;
}

export function chooseTone(prompt: string): string | null {
  const result = chooseToneWithConfidence(prompt);
  return result?.tone ?? null;
}

export function chooseToneWithConfidence(prompt: string): ToneInference | null {
  const normalized = normalizePrompt(prompt);
  let best: ToneInference | null = null;

  for (const { tone, pattern } of TONE_PATTERNS) {
    const matches = countMatches(normalized, new RegExp(pattern.source, "g"));
    if (matches > 0) {
      const confidence = computeConfidence(INFERENCE_FIELD_CONFIDENCE.tone, matches);
      if (!best || matches > best.matchCount) {
        best = { tone, matchCount: matches, confidence };
      }
    }
  }

  return best;
}

/* ------------------------------------------------------------------ */
/*  Length preference                                                   */
/* ------------------------------------------------------------------ */

export function chooseLengthPreference(prompt: string): "brief" | "detailed" | null {
  const normalized = normalizePrompt(prompt);
  if (/(brief|short|tl;dr|concise|summary)\b/.test(normalized)) return "brief";
  if (/(detailed|deep dive|comprehensive|thorough)\b/.test(normalized)) return "detailed";
  return null;
}

/* ------------------------------------------------------------------ */
/*  Format detection                                                   */
/* ------------------------------------------------------------------ */

export function chooseFormat(prompt: string): string[] {
  const normalized = normalizePrompt(prompt);
  if (/(json)\b/.test(normalized)) return ["JSON"];
  if (/(table|tabular)\b/.test(normalized)) return ["Table"];
  if (/(bullet|bulleted|list|checklist|steps)\b/.test(normalized)) return ["Bullet points"];
  if (/(markdown)\b/.test(normalized)) return ["Markdown"];
  return [];
}

/* ------------------------------------------------------------------ */
/*  Constraints detection                                              */
/* ------------------------------------------------------------------ */

export function chooseConstraints(prompt: string): string[] {
  const normalized = normalizePrompt(prompt);
  const values: string[] = [];
  if (/(cite|citation|source)\b/.test(normalized)) values.push("Include citations");
  if (/(plain language|simple wording|no jargon)\b/.test(normalized)) values.push("Avoid jargon");
  return values;
}

/* ------------------------------------------------------------------ */
/*  Artifact-type detection (new)                                      */
/* ------------------------------------------------------------------ */

export type ArtifactType =
  | "email"
  | "report"
  | "PRD"
  | "proposal"
  | "presentation"
  | "code snippet"
  | "blog post"
  | "documentation";

interface ArtifactMatch {
  type: ArtifactType;
  pattern: RegExp;
}

const ARTIFACT_PATTERNS: ArtifactMatch[] = [
  { type: "email", pattern: /\b(email|mail|message|newsletter|outreach)\b/g },
  { type: "report", pattern: /\b(report|analysis report|summary report|status update|weekly report)\b/g },
  { type: "PRD", pattern: /\b(prd|product requirements|requirements document|product spec)\b/g },
  { type: "proposal", pattern: /\b(proposal|pitch|rfp|business case)\b/g },
  { type: "presentation", pattern: /\b(presentation|slides|deck|powerpoint|keynote)\b/g },
  { type: "code snippet", pattern: /\b(code snippet|function|script|implementation|code example)\b/g },
  { type: "blog post", pattern: /\b(blog post|blog|article|post|content piece)\b/g },
  { type: "documentation", pattern: /\b(documentation|docs|readme|guide|tutorial|how-to)\b/g },
];

export interface ArtifactInference {
  type: ArtifactType;
  matchCount: number;
  confidence: number;
}

export function chooseArtifactType(prompt: string): ArtifactInference | null {
  const normalized = normalizePrompt(prompt);
  let best: ArtifactInference | null = null;

  for (const { type, pattern } of ARTIFACT_PATTERNS) {
    const matches = countMatches(normalized, new RegExp(pattern.source, "g"));
    if (matches > 0) {
      const confidence = computeConfidence(0.70, matches);
      if (!best || matches > best.matchCount) {
        best = { type, matchCount: matches, confidence };
      }
    }
  }

  return best;
}

/* ------------------------------------------------------------------ */
/*  Audience-hint detection (new)                                      */
/* ------------------------------------------------------------------ */

export type AudienceHint =
  | "beginner"
  | "expert"
  | "executive"
  | "developer"
  | "customer"
  | "team"
  | "public"
  | "internal";

interface AudienceMatch {
  audience: AudienceHint;
  pattern: RegExp;
}

const AUDIENCE_PATTERNS: AudienceMatch[] = [
  { audience: "beginner", pattern: /\b(beginner|newcomer|non-technical|layperson|novice|new to)\b/g },
  { audience: "expert", pattern: /\b(expert|advanced|senior|experienced|specialist)\b/g },
  { audience: "executive", pattern: /\b(executive|c-suite|ceo|cto|cfo|leadership|board)\b/g },
  { audience: "developer", pattern: /\b(developer|engineer|programmer|dev team|software team)\b/g },
  { audience: "customer", pattern: /\b(customer|user|client|end user|subscriber)\b/g },
  { audience: "team", pattern: /\b(team|colleagues|staff|internal team|cross-functional)\b/g },
  { audience: "public", pattern: /\b(public|general audience|everyone|broad audience|consumers)\b/g },
  { audience: "internal", pattern: /\b(internal|company-wide|org-wide|intranet|internal memo)\b/g },
];

export interface AudienceInference {
  audience: AudienceHint;
  matchCount: number;
  confidence: number;
}

export function chooseAudience(prompt: string): AudienceInference | null {
  const normalized = normalizePrompt(prompt);
  let best: AudienceInference | null = null;

  for (const { audience, pattern } of AUDIENCE_PATTERNS) {
    const matches = countMatches(normalized, new RegExp(pattern.source, "g"));
    if (matches > 0) {
      const confidence = computeConfidence(0.68, matches);
      if (!best || matches > best.matchCount) {
        best = { audience, matchCount: matches, confidence };
      }
    }
  }

  return best;
}

/* ------------------------------------------------------------------ */
/*  Task-mode detection: transform vs generate (new)                   */
/* ------------------------------------------------------------------ */

export type TaskMode = "transform" | "generate";

const TRANSFORM_PATTERN = /\b(rewrite|edit|revise|improve|fix|convert|translate|summarize|shorten|simplify|refine|rephrase|update|correct|polish)\b/g;
const GENERATE_PATTERN = /\b(write|create|draft|build|design|brainstorm|plan|compose|generate|produce|develop|outline|propose|invent)\b/g;

export interface TaskModeInference {
  mode: TaskMode;
  matchCount: number;
  confidence: number;
}

export function chooseTaskMode(prompt: string): TaskModeInference | null {
  const normalized = normalizePrompt(prompt);
  const transformMatches = countMatches(normalized, TRANSFORM_PATTERN);
  const generateMatches = countMatches(normalized, GENERATE_PATTERN);

  if (transformMatches === 0 && generateMatches === 0) return null;

  if (transformMatches >= generateMatches) {
    return {
      mode: "transform",
      matchCount: transformMatches,
      confidence: computeConfidence(0.72, transformMatches),
    };
  }

  return {
    mode: "generate",
    matchCount: generateMatches,
    confidence: computeConfidence(0.72, generateMatches),
  };
}
