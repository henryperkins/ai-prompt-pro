/**
 * Codex export helpers.
 *
 * Generates:
 * - AGENTS.md / AGENTS.override.md content (size-capped to Codex's default project_doc_max_bytes)
 * - Bash snippets for:
 *   - `codex "<PROMPT>"` (launch TUI with a pre-filled prompt)
 *   - `codex exec -` (non-interactive; reads prompt from stdin)
 *   - `codex debug app-server send-message-v2 "<PROMPT>"` (debug client)
 */

export const CODEX_DEFAULT_PROJECT_DOC_MAX_BYTES = 32 * 1024;
export const CODEX_DEFAULT_SKILL_NAME = "promptforge-export";
export const CODEX_DEFAULT_SKILL_DESCRIPTION =
  "PromptForge-exported workflow for Codex. Use when you want Codex to execute this exact workflow.";

const encoder = new TextEncoder();
const fatalDecoder = new TextDecoder("utf-8", { fatal: true });

export function utf8ByteLength(text: string): number {
  return encoder.encode(text).length;
}

function safeDecodeUtf8(bytes: Uint8Array): string {
  // Avoid returning text that ends on an incomplete UTF-8 sequence.
  for (let end = bytes.length; end >= 0; end -= 1) {
    try {
      return fatalDecoder.decode(bytes.slice(0, end));
    } catch {
      // Keep trimming until decode succeeds.
    }
  }

  return "";
}

export function truncateToUtf8Bytes(
  text: string,
  maxBytes: number,
  suffix: string = "\n\n...\n",
): string {
  if (maxBytes <= 0) return "";

  const bytes = encoder.encode(text);
  if (bytes.length <= maxBytes) return text;

  const suffixBytes = encoder.encode(suffix);
  if (suffixBytes.length >= maxBytes) {
    return safeDecodeUtf8(bytes.slice(0, maxBytes));
  }

  const targetBytes = maxBytes - suffixBytes.length;
  return safeDecodeUtf8(bytes.slice(0, targetBytes)) + suffix;
}

function normalizeNewlines(text: string): string {
  return (text ?? "").replace(/\r\n/g, "\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function yamlDoubleQuoted(value: string): string {
  return JSON.stringify(value ?? "");
}

function shellSingleQuoted(value: string): string {
  return `'${(value ?? "").replace(/'/g, "'\"'\"'")}'`;
}

function trimHyphens(value: string): string {
  return value.replace(/^-+/, "").replace(/-+$/, "");
}

function clampText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  if (maxChars <= 3) return value.slice(0, maxChars);
  return `${value.slice(0, maxChars - 3).trimEnd()}...`;
}

function firstNonEmptyLine(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) ?? "";
}

export function sanitizeSkillName(name: string, fallback: string = CODEX_DEFAULT_SKILL_NAME): string {
  const normalized = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-");
  const trimmed = trimHyphens(normalized);
  const sliced = trimHyphens(trimmed.slice(0, 64));
  if (sliced) return sliced;

  const fallbackNormalized = (fallback ?? CODEX_DEFAULT_SKILL_NAME)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-");
  return trimHyphens(fallbackNormalized) || CODEX_DEFAULT_SKILL_NAME;
}

export function generateSkillDescriptionFromPrompt(prompt: string): string {
  const normalized = normalizeNewlines(prompt ?? "");
  const firstLine = firstNonEmptyLine(normalized).replace(/\s+/g, " ").trim();
  if (!firstLine) return CODEX_DEFAULT_SKILL_DESCRIPTION;

  const prefix = "PromptForge-exported workflow. Use when the task matches this prompt: ";
  return clampText(`${prefix}${firstLine}`, 1024);
}

/**
 * Choose a heredoc delimiter that does not appear as a full line in the prompt.
 */
export function chooseHereDocDelimiter(prompt: string, base: string = "PROMPTFORGE_PROMPT"): string {
  const text = normalizeNewlines(prompt ?? "");
  let delimiter = base;
  let suffix = 0;

  while (new RegExp(`^${escapeRegExp(delimiter)}$`, "m").test(text)) {
    suffix += 1;
    delimiter = `${base}_${suffix}`;
  }

  return delimiter;
}

/**
 * Returns a bash command substitution that yields the prompt via heredoc.
 */
export function buildBashHereDocSubstitution(
  prompt: string,
  delimiterBase: string = "PROMPTFORGE_PROMPT",
): string {
  const normalized = normalizeNewlines(prompt ?? "");
  const delimiter = chooseHereDocDelimiter(normalized, delimiterBase);
  return `$(cat <<'${delimiter}'\n${normalized}\n${delimiter}\n)`;
}

export function generateCodexTuiCommandBash(
  prompt: string,
  options?: { codexBin?: string; flags?: string[] | string },
): string {
  const codexBin = options?.codexBin ?? "codex";
  const normalized = normalizeNewlines(prompt ?? "");
  const flags = Array.isArray(options?.flags) ? options.flags.join(" ") : (options?.flags ?? "");
  const flagsPart = flags.trim() ? ` ${flags.trim()}` : "";
  const substitution = buildBashHereDocSubstitution(normalized);
  return `${codexBin}${flagsPart} "${substitution}"`;
}

export function generateCodexExecCommandBash(
  prompt: string,
  options?: { codexBin?: string; flags?: string[] | string },
): string {
  const codexBin = options?.codexBin ?? "codex";
  const normalized = normalizeNewlines(prompt ?? "");
  const flags = Array.isArray(options?.flags) ? options.flags.join(" ") : (options?.flags ?? "");
  const flagsPart = flags.trim() ? ` ${flags.trim()}` : "";
  const delimiter = chooseHereDocDelimiter(normalized, "PROMPTFORGE_PROMPT");

  return `cat <<'${delimiter}' | ${codexBin} exec${flagsPart} -\n${normalized}\n${delimiter}`;
}

export function generateCodexAppServerSendMessageV2CommandBash(
  prompt: string,
  options?: { codexBin?: string },
): string {
  const codexBin = options?.codexBin ?? "codex";
  const normalized = normalizeNewlines(prompt ?? "");
  const substitution = buildBashHereDocSubstitution(normalized);
  return `${codexBin} debug app-server send-message-v2 "${substitution}"`;
}

export function generateSkillMdFromPrompt(
  prompt: string,
  options?: { skillName?: string; description?: string },
): string {
  const normalized = normalizeNewlines(prompt ?? "").trim();
  if (!normalized) return "";

  const name = sanitizeSkillName(options?.skillName ?? CODEX_DEFAULT_SKILL_NAME);
  const description = clampText(
    (options?.description ?? generateSkillDescriptionFromPrompt(normalized)).trim() ||
      CODEX_DEFAULT_SKILL_DESCRIPTION,
    1024,
  );

  return `---\nname: ${name}\ndescription: ${yamlDoubleQuoted(description)}\n---\n\n${normalized}\n`;
}

export function generateCodexSkillScaffoldCommandBash(
  prompt: string,
  options?: { skillName?: string; description?: string; skillRoot?: string },
): string {
  const skillName = sanitizeSkillName(options?.skillName ?? CODEX_DEFAULT_SKILL_NAME);
  const skillRoot = (options?.skillRoot ?? ".agents/skills").replace(/\/+$/, "");
  const skillDir = `${skillRoot}/${skillName}`;
  const skillFilePath = `${skillDir}/SKILL.md`;
  const skillContent = generateSkillMdFromPrompt(prompt, {
    skillName,
    description: options?.description,
  });
  const delimiter = chooseHereDocDelimiter(skillContent, "PROMPTFORGE_SKILL");

  return `mkdir -p ${shellSingleQuoted(skillDir)}\ncat <<'${delimiter}' > ${shellSingleQuoted(skillFilePath)}\n${skillContent}${delimiter}`;
}

export function generateAgentsMdFromPrompt(prompt: string, options?: { maxBytes?: number }): string {
  const maxBytes = options?.maxBytes ?? CODEX_DEFAULT_PROJECT_DOC_MAX_BYTES;
  const normalized = normalizeNewlines(prompt ?? "").trim();
  if (!normalized) return "";

  const body = `${normalized}\n`;
  if (utf8ByteLength(body) <= maxBytes) return body;
  return truncateToUtf8Bytes(body, maxBytes);
}

export function generateAgentsOverrideMdFromPrompt(prompt: string, options?: { maxBytes?: number }): string {
  return generateAgentsMdFromPrompt(prompt, options);
}
