import { AGENT_SERVICE_URL, buildAgentServiceUrl } from "@/lib/agent-service-url";

export interface AgentServiceCapabilities {
  githubContextConfigured: boolean;
  githubContextAvailable: boolean;
}

export const DEFAULT_AGENT_SERVICE_CAPABILITIES: AgentServiceCapabilities = Object.freeze({
  githubContextConfigured: false,
  githubContextAvailable: false,
});

export function hasAgentServiceCapabilitiesEndpoint(): boolean {
  return Boolean(AGENT_SERVICE_URL);
}

export async function fetchAgentServiceCapabilities(
  signal?: AbortSignal,
): Promise<AgentServiceCapabilities> {
  const response = await fetch(buildAgentServiceUrl("/health/details"), {
    method: "GET",
    signal,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      (payload as { error?: string }).error || `Request failed (${response.status}).`,
    );
  }

  const details = payload as {
    github_context_configured?: unknown;
    github_context_available?: unknown;
  };

  return {
    githubContextConfigured: details.github_context_configured === true,
    githubContextAvailable: details.github_context_available === true,
  };
}
