import type {
  ContextConfig,
  ContextReference,
  ContextSource,
  ContextSourceType,
  DatabaseConnection,
  RagParameters,
  SourceValidationStatus,
} from "@/lib/context-types";
import { defaultContextConfig } from "@/lib/context-types";
import type { PromptConfig } from "@/lib/prompt-builder";
import { defaultConfig } from "@/lib/prompt-builder";

const STORAGE_KEY = "promptforge-template-snapshots";
const CURRENT_SCHEMA_VERSION = 2;
const STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 14;

type SaveOutcome = "created" | "updated" | "unchanged";

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  tags: string[];
  schemaVersion: number;
  revision: number;
  fingerprint: string;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateExternalReference {
  sourceId: string;
  sourceType: ContextSourceType;
  refId: string;
  locator: string;
  title: string;
  permissionScope?: string;
  status: SourceValidationStatus;
  checkedAt?: number;
}

export interface TemplateState {
  promptConfig: PromptConfig;
  externalReferences: TemplateExternalReference[];
}

export interface TemplateRecord {
  metadata: TemplateMetadata;
  state: TemplateState;
}

export interface TemplateSaveInput {
  name: string;
  description?: string;
  tags?: string[];
  config: PromptConfig;
}

export interface SaveTemplateResult {
  outcome: SaveOutcome;
  record: TemplateRecord;
  warnings: string[];
}

export interface TemplateLoadResult {
  record: TemplateRecord;
  warnings: string[];
}

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  starterPrompt: string;
  updatedAt: number;
  createdAt: number;
  revision: number;
  schemaVersion: number;
  sourceCount: number;
  databaseCount: number;
  ragEnabled: boolean;
}

interface TemplateEnvelope {
  schemaVersion: number;
  records: unknown[];
}

interface LegacyTemplateRecordV1 {
  id: string;
  name: string;
  description?: string;
  role: string;
  task: string;
  context: string;
  format: string[];
  lengthPreference: string;
  tone: string;
  complexity: string;
  constraints: string[];
  examples: string;
}

export const TEMPLATE_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "PromptTemplateSnapshot",
  type: "object",
  required: ["metadata", "state"],
  properties: {
    metadata: {
      type: "object",
      required: ["id", "name", "schemaVersion", "revision", "fingerprint", "createdAt", "updatedAt"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        schemaVersion: { type: "integer", minimum: 1 },
        revision: { type: "integer", minimum: 1 },
        fingerprint: { type: "string" },
        createdAt: { type: "integer" },
        updatedAt: { type: "integer" },
      },
      additionalProperties: false,
    },
    state: {
      type: "object",
      required: ["promptConfig", "externalReferences"],
      properties: {
        promptConfig: { type: "object" },
        externalReferences: {
          type: "array",
          items: {
            type: "object",
            required: ["sourceId", "sourceType", "refId", "locator", "title", "status"],
          },
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeContextConfig(input?: ContextConfig): ContextConfig {
  const raw = input || defaultContextConfig;
  const rag: RagParameters = {
    ...defaultContextConfig.rag,
    ...raw.rag,
    documentRefs: Array.isArray(raw.rag?.documentRefs) ? raw.rag.documentRefs : [],
  };

  const databaseConnections: DatabaseConnection[] = Array.isArray(raw.databaseConnections)
    ? raw.databaseConnections.map((db) => ({
        id: db.id || generateId("db"),
        label: db.label || db.connectionRef || "Database",
        provider: db.provider || "other",
        connectionRef: db.connectionRef || "",
        database: db.database || "",
        schema: db.schema || "",
        tables: Array.isArray(db.tables) ? db.tables : [],
        readOnly: db.readOnly !== false,
        lastValidatedAt: db.lastValidatedAt,
      }))
    : [];

  return {
    ...defaultContextConfig,
    ...raw,
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    databaseConnections,
    rag,
    structured: { ...defaultContextConfig.structured, ...raw.structured },
    interviewAnswers: Array.isArray(raw.interviewAnswers) ? raw.interviewAnswers : [],
  };
}

export function normalizeTemplateConfig(config: PromptConfig): PromptConfig {
  const merged: PromptConfig = {
    ...defaultConfig,
    ...config,
    contextConfig: mergeContextConfig(config.contextConfig),
    format: Array.isArray(config.format) ? config.format : [],
    constraints: Array.isArray(config.constraints) ? config.constraints : [],
  };

  return {
    ...merged,
    contextConfig: {
      ...merged.contextConfig,
      sources: merged.contextConfig.sources.map((source) => normalizeSource(source)),
    },
  };
}

export function computeTemplateFingerprint(config: PromptConfig): string {
  const canonical = cloneDeep(config);
  canonical.contextConfig.sources = canonical.contextConfig.sources.map((source) => ({
    ...source,
    addedAt: 0,
    validation: source.validation
      ? {
          ...source.validation,
          checkedAt: 0,
        }
      : source.validation,
  }));
  canonical.contextConfig.databaseConnections = canonical.contextConfig.databaseConnections.map((db) => ({
    ...db,
    lastValidatedAt: 0,
  }));
  return fnv1aHash(stableStringify(canonical));
}

function createReference(source: ContextSource): ContextReference | undefined {
  if (source.type === "text") return source.reference;
  const defaultLocator =
    source.type === "url"
      ? source.rawContent.trim()
      : source.type === "file"
        ? source.title
        : source.title || source.id;
  const fallbackRefId = `${source.type}:${source.id}`;

  if (source.type === "url" || source.type === "file" || source.type === "database" || source.type === "rag") {
    return {
      kind: source.type,
      refId: source.reference?.refId || fallbackRefId,
      locator: source.reference?.locator || defaultLocator,
      permissionScope: source.reference?.permissionScope,
    };
  }

  return source.reference;
}

function normalizeSource(source: ContextSource): ContextSource {
  const normalizedReference = createReference(source);
  const shouldStripRaw =
    source.type === "url" || source.type === "file" || source.type === "database" || source.type === "rag";

  return {
    ...source,
    title: source.title || "Source",
    rawContent: shouldStripRaw ? "" : source.rawContent || "",
    summary: source.summary || "",
    reference: normalizedReference,
    validation: validateSource({ ...source, reference: normalizedReference }),
  };
}

function validateSource(source: ContextSource): ContextSource["validation"] {
  const checkedAt = Date.now();
  if (source.type === "text") {
    return { status: "valid", checkedAt };
  }

  if (!source.reference?.refId || !source.reference.locator) {
    return { status: "invalid", checkedAt, message: "Missing external reference ID or locator." };
  }

  if (source.type === "url") {
    try {
      const url = new URL(source.reference.locator);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { status: "invalid", checkedAt, message: "URL sources must use http(s)." };
      }
    } catch {
      return { status: "invalid", checkedAt, message: "Malformed URL reference." };
    }
  }

  if (source.validation?.checkedAt && checkedAt - source.validation.checkedAt > STALE_AFTER_MS) {
    return { status: "stale", checkedAt: source.validation.checkedAt, message: "Source requires re-validation." };
  }

  return { status: "unknown", checkedAt };
}

function validateDatabaseConnections(databases: DatabaseConnection[]): string[] {
  const warnings: string[] = [];

  databases.forEach((db) => {
    if (!db.connectionRef.trim()) warnings.push(`DB "${db.label}" is missing connectionRef.`);
    if (!db.database.trim()) warnings.push(`DB "${db.label}" is missing database name.`);
    if (!db.readOnly) warnings.push(`DB "${db.label}" should be readOnly for template safety.`);
    if (db.lastValidatedAt && Date.now() - db.lastValidatedAt > STALE_AFTER_MS) {
      warnings.push(`DB "${db.label}" permissions may be stale.`);
    }
  });

  return warnings;
}

function validateRag(rag: RagParameters): string[] {
  if (!rag.enabled) return [];
  const warnings: string[] = [];
  if (!rag.vectorStoreRef.trim()) warnings.push("RAG is enabled but vectorStoreRef is missing.");
  if (rag.topK < 1 || rag.topK > 100) warnings.push("RAG topK must be between 1 and 100.");
  if (rag.minScore < 0 || rag.minScore > 1) warnings.push("RAG minScore must be between 0 and 1.");
  if (rag.chunkWindow < 1 || rag.chunkWindow > 20) warnings.push("RAG chunkWindow must be between 1 and 20.");
  return warnings;
}

export function collectTemplateWarnings(config: PromptConfig): string[] {
  const warnings: string[] = [];
  config.contextConfig.sources.forEach((source) => {
    if (source.validation?.status === "invalid") {
      warnings.push(`${source.title}: ${source.validation.message || "Invalid source reference."}`);
    }
    if (source.validation?.status === "stale") {
      warnings.push(`${source.title}: source reference should be re-validated.`);
    }
  });

  warnings.push(...validateDatabaseConnections(config.contextConfig.databaseConnections));
  warnings.push(...validateRag(config.contextConfig.rag));
  return warnings;
}

export function deriveExternalReferencesFromConfig(config: PromptConfig): TemplateExternalReference[] {
  const sourceRefs: TemplateExternalReference[] = config.contextConfig.sources
    .filter((source) => source.type !== "text")
    .map((source) => ({
      sourceId: source.id,
      sourceType: source.type,
      refId: source.reference?.refId || `${source.type}:${source.id}`,
      locator: source.reference?.locator || source.title,
      title: source.title,
      permissionScope: source.reference?.permissionScope,
      status: source.validation?.status || "unknown",
      checkedAt: source.validation?.checkedAt,
    }));

  const dbRefs: TemplateExternalReference[] = config.contextConfig.databaseConnections.map((db) => ({
    sourceId: db.id,
    sourceType: "database",
    refId: db.connectionRef,
    locator: `${db.database}${db.schema ? `.${db.schema}` : ""}`,
    title: db.label,
    permissionScope: db.readOnly ? "read_only" : "read_write",
    status: db.connectionRef.trim() && db.database.trim() ? "unknown" : "invalid",
    checkedAt: db.lastValidatedAt,
  }));

  const ragRefs: TemplateExternalReference[] =
    config.contextConfig.rag.enabled && config.contextConfig.rag.vectorStoreRef.trim()
      ? [
          {
            sourceId: `rag:${config.contextConfig.rag.vectorStoreRef}`,
            sourceType: "rag",
            refId: config.contextConfig.rag.vectorStoreRef,
            locator: config.contextConfig.rag.namespace || "default",
            title: "Vector Store",
            status: "unknown",
            checkedAt: Date.now(),
          },
          ...config.contextConfig.rag.documentRefs.map((docId) => ({
            sourceId: `rag-doc:${docId}`,
            sourceType: "rag" as const,
            refId: docId,
            locator: config.contextConfig.rag.vectorStoreRef,
            title: `RAG Document ${docId}`,
            status: "unknown" as const,
            checkedAt: Date.now(),
          })),
        ]
      : [];

  return [...sourceRefs, ...dbRefs, ...ragRefs];
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

function fnv1aHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`;
}

function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function parseEnvelope(raw: string | null): TemplateEnvelope {
  if (!raw) return { schemaVersion: CURRENT_SCHEMA_VERSION, records: [] };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { schemaVersion: 1, records: parsed };
    }
    if (isRecord(parsed) && Array.isArray(parsed.records)) {
      return {
        schemaVersion:
          typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : CURRENT_SCHEMA_VERSION,
        records: parsed.records,
      };
    }
  } catch {
    // fall through
  }
  return { schemaVersion: CURRENT_SCHEMA_VERSION, records: [] };
}

function migrateLegacyV1(legacy: LegacyTemplateRecordV1): TemplateRecord {
  const now = Date.now();
  const config: PromptConfig = normalizeTemplateConfig({
    ...defaultConfig,
    role: legacy.role || "",
    task: legacy.task || "",
    context: legacy.context || "",
    format: Array.isArray(legacy.format) ? legacy.format : [],
    lengthPreference: legacy.lengthPreference || "standard",
    tone: legacy.tone || "Professional",
    complexity: legacy.complexity || "Moderate",
    constraints: Array.isArray(legacy.constraints) ? legacy.constraints : [],
    examples: legacy.examples || "",
  });
  const fingerprint = computeTemplateFingerprint(config);
  return {
    metadata: {
      id: legacy.id || generateId("tpl"),
      name: legacy.name || "Migrated Preset",
      description: legacy.description || "",
      tags: [],
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      fingerprint,
      createdAt: now,
      updatedAt: now,
    },
    state: {
      promptConfig: config,
      externalReferences: deriveExternalReferencesFromConfig(config),
    },
  };
}

function parseTemplateRecord(raw: unknown): TemplateRecord | null {
  if (!isRecord(raw)) return null;

  if ("metadata" in raw && "state" in raw && isRecord(raw.metadata) && isRecord(raw.state)) {
    const metadata = raw.metadata;
    const state = raw.state;
    if (typeof metadata.name !== "string" || typeof metadata.id !== "string") return null;
    const normalizedConfig = normalizeTemplateConfig((state.promptConfig || defaultConfig) as PromptConfig);
    const externalReferences = Array.isArray(state.externalReferences)
      ? (state.externalReferences as TemplateExternalReference[])
      : deriveExternalReferencesFromConfig(normalizedConfig);

    return {
      metadata: {
        id: metadata.id,
        name: metadata.name,
        description: typeof metadata.description === "string" ? metadata.description : "",
        tags: Array.isArray(metadata.tags) ? metadata.tags.filter((t): t is string => typeof t === "string") : [],
        schemaVersion:
          typeof metadata.schemaVersion === "number" ? metadata.schemaVersion : CURRENT_SCHEMA_VERSION,
        revision: typeof metadata.revision === "number" && metadata.revision > 0 ? metadata.revision : 1,
        fingerprint:
          typeof metadata.fingerprint === "string"
            ? metadata.fingerprint
            : computeTemplateFingerprint(normalizedConfig),
        createdAt: typeof metadata.createdAt === "number" ? metadata.createdAt : Date.now(),
        updatedAt: typeof metadata.updatedAt === "number" ? metadata.updatedAt : Date.now(),
      },
      state: {
        promptConfig: normalizedConfig,
        externalReferences,
      },
    };
  }

  const looksLegacy =
    typeof raw.name === "string" &&
    typeof raw.role === "string" &&
    typeof raw.task === "string" &&
    typeof raw.context === "string";
  if (looksLegacy) {
    return migrateLegacyV1(raw as LegacyTemplateRecordV1);
  }
  return null;
}

function readAllRecords(): TemplateRecord[] {
  if (typeof window === "undefined") return [];
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  const envelope = parseEnvelope(raw);
  const records = envelope.records.map(parseTemplateRecord).filter((r): r is TemplateRecord => !!r);
  return records.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt);
}

function writeAllRecords(records: TemplateRecord[]): void {
  if (typeof window === "undefined") return;
  const payload: TemplateEnvelope = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    records: records.map((record) => cloneDeep(record)),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures to avoid crashing the UI.
  }
}

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clipText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 3).trimEnd()}...`;
}

export function inferTemplateStarterPrompt(config: PromptConfig): string {
  const candidates = [
    config.task,
    config.originalPrompt,
    config.contextConfig.structured.offer,
    config.contextConfig.structured.product,
  ];
  const first = candidates.map(toSingleLine).find((value) => value.length > 0);
  if (!first) {
    return "Start by stating the goal, audience, and desired output format.";
  }
  return clipText(first, 120);
}

export function listTemplateSummaries(): TemplateSummary[] {
  return readAllRecords().map((record) => ({
    id: record.metadata.id,
    name: record.metadata.name,
    description: record.metadata.description,
    tags: record.metadata.tags,
    starterPrompt: inferTemplateStarterPrompt(record.state.promptConfig),
    updatedAt: record.metadata.updatedAt,
    createdAt: record.metadata.createdAt,
    revision: record.metadata.revision,
    schemaVersion: record.metadata.schemaVersion,
    sourceCount: record.state.promptConfig.contextConfig.sources.length,
    databaseCount: record.state.promptConfig.contextConfig.databaseConnections.length,
    ragEnabled: record.state.promptConfig.contextConfig.rag.enabled,
  }));
}

export function loadTemplateById(id: string): TemplateLoadResult | null {
  const records = readAllRecords();
  const record = records.find((entry) => entry.metadata.id === id);
  if (!record) return null;
  return {
    record: cloneDeep(record),
    warnings: collectTemplateWarnings(record.state.promptConfig),
  };
}

export function saveTemplateSnapshot(input: TemplateSaveInput): SaveTemplateResult {
  const name = input.name.trim();
  if (!name) throw new Error("Preset name is required.");

  const now = Date.now();
  const normalizedConfig = normalizeTemplateConfig(input.config);
  const normalizedDescription = input.description === undefined ? undefined : input.description.trim();
  const fingerprint = computeTemplateFingerprint(normalizedConfig);
  const warnings = collectTemplateWarnings(normalizedConfig);
  const records = readAllRecords();
  const existingIndex = records.findIndex((record) => record.metadata.name.toLowerCase() === name.toLowerCase());

  if (existingIndex >= 0) {
    const existing = records[existingIndex];
    if (existing.metadata.fingerprint === fingerprint) {
      return {
        outcome: "unchanged",
        record: cloneDeep(existing),
        warnings,
      };
    }

    const updated: TemplateRecord = {
      metadata: {
        ...existing.metadata,
        description: normalizedDescription ?? existing.metadata.description,
        tags: Array.isArray(input.tags) ? input.tags.map((tag) => tag.trim()).filter(Boolean) : existing.metadata.tags,
        revision: existing.metadata.revision + 1,
        fingerprint,
        updatedAt: now,
      },
      state: {
        promptConfig: normalizedConfig,
        externalReferences: deriveExternalReferencesFromConfig(normalizedConfig),
      },
    };

    const next = [...records];
    next.splice(existingIndex, 1, updated);
    writeAllRecords(next);
    return { outcome: "updated", record: cloneDeep(updated), warnings };
  }

  const created: TemplateRecord = {
    metadata: {
      id: generateId("tpl"),
      name,
      description: normalizedDescription ?? "",
      tags: Array.isArray(input.tags) ? input.tags.map((tag) => tag.trim()).filter(Boolean) : [],
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      fingerprint,
      createdAt: now,
      updatedAt: now,
    },
    state: {
      promptConfig: normalizedConfig,
      externalReferences: deriveExternalReferencesFromConfig(normalizedConfig),
    },
  };

  writeAllRecords([created, ...records]);
  return { outcome: "created", record: cloneDeep(created), warnings };
}

export function deleteTemplateById(id: string): boolean {
  const records = readAllRecords();
  const next = records.filter((record) => record.metadata.id !== id);
  if (next.length === records.length) return false;
  writeAllRecords(next);
  return true;
}

export function clearAllTemplatesForTest(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures in constrained environments.
  }
}
