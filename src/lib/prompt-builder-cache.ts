import { defaultContextConfig } from "@/lib/context-types";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";
import type { PromptSummary, PromptVersion } from "@/lib/persistence";
import type { TemplateSummary } from "@/lib/template-store";

const STORAGE_KEY = "promptforge-draft";
const LOCAL_VERSIONS_KEY = "promptforge-local-versions";
const CLOUD_VERSIONS_KEY_PREFIX = "promptforge-cloud-versions";

export const MAX_LOCAL_VERSIONS = 50;

function isPromptVersion(value: unknown): value is PromptVersion {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.prompt === "string" &&
    typeof candidate.timestamp === "number"
  );
}

function cloudVersionsKey(userId: string): string {
  return `${CLOUD_VERSIONS_KEY_PREFIX}:${userId}`;
}

export function hydrateConfig(raw: unknown): PromptConfig {
  if (!raw || typeof raw !== "object") return defaultConfig;
  const candidate = raw as Partial<PromptConfig>;
  return {
    ...defaultConfig,
    ...candidate,
    format: Array.isArray(candidate.format) ? candidate.format : [],
    constraints: Array.isArray(candidate.constraints) ? candidate.constraints : [],
    contextConfig: {
      ...defaultContextConfig,
      ...(candidate.contextConfig || {}),
      sources: Array.isArray(candidate.contextConfig?.sources) ? candidate.contextConfig.sources : [],
      databaseConnections: Array.isArray(candidate.contextConfig?.databaseConnections)
        ? candidate.contextConfig.databaseConnections
        : [],
      rag: {
        ...defaultContextConfig.rag,
        ...(candidate.contextConfig?.rag || {}),
        documentRefs: Array.isArray(candidate.contextConfig?.rag?.documentRefs)
          ? candidate.contextConfig.rag.documentRefs
          : [],
      },
      structured: {
        ...defaultContextConfig.structured,
        ...(candidate.contextConfig?.structured || {}),
      },
      interviewAnswers: Array.isArray(candidate.contextConfig?.interviewAnswers)
        ? candidate.contextConfig.interviewAnswers
        : [],
    },
  };
}

export function loadLocalDraft(): PromptConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? hydrateConfig(JSON.parse(saved)) : defaultConfig;
  } catch {
    return defaultConfig;
  }
}

export function loadLocalVersions(): PromptVersion[] {
  try {
    const saved = localStorage.getItem(LOCAL_VERSIONS_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPromptVersion).sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_LOCAL_VERSIONS);
  } catch {
    return [];
  }
}

export function saveLocalVersions(versions: PromptVersion[]): void {
  try {
    localStorage.setItem(LOCAL_VERSIONS_KEY, JSON.stringify(versions.slice(0, MAX_LOCAL_VERSIONS)));
  } catch {
    // quota errors are intentionally ignored to keep the UI responsive
  }
}

export function clearLocalVersions(): void {
  try {
    localStorage.removeItem(LOCAL_VERSIONS_KEY);
  } catch {
    // ignore
  }
}

export function createVersionId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadCachedCloudVersions(userId: string | null): PromptVersion[] {
  if (!userId) return [];
  try {
    const saved = sessionStorage.getItem(cloudVersionsKey(userId));
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPromptVersion).sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_LOCAL_VERSIONS);
  } catch {
    return [];
  }
}

export function saveCachedCloudVersions(userId: string | null, versions: PromptVersion[]): void {
  if (!userId) return;
  try {
    sessionStorage.setItem(cloudVersionsKey(userId), JSON.stringify(versions.slice(0, MAX_LOCAL_VERSIONS)));
  } catch {
    // ignore
  }
}

export function clearCachedCloudVersions(userId: string | null): void {
  if (!userId) return;
  try {
    sessionStorage.removeItem(cloudVersionsKey(userId));
  } catch {
    // ignore
  }
}

export function toPromptSummary(template: TemplateSummary): PromptSummary {
  return {
    ...template,
    category: "general",
    isShared: false,
    communityPostId: null,
    targetModel: "",
    useCase: "",
    remixedFrom: null,
    builtPrompt: "",
    enhancedPrompt: "",
    upvoteCount: 0,
    verifiedCount: 0,
    remixCount: 0,
    commentCount: 0,
  };
}
