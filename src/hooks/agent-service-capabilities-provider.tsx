import { useEffect, useState, type PropsWithChildren } from "react";
import {
  DEFAULT_AGENT_SERVICE_CAPABILITIES,
  fetchAgentServiceCapabilities,
  hasAgentServiceCapabilitiesEndpoint,
} from "@/lib/agent-service-capabilities";
import {
  AgentServiceCapabilitiesContext,
  DEFAULT_AGENT_SERVICE_CAPABILITIES_STATE,
  type AgentServiceCapabilitiesState,
} from "@/hooks/useAgentServiceCapabilities";

export function AgentServiceCapabilitiesProvider({ children }: PropsWithChildren) {
  const [capabilities, setCapabilities] = useState<AgentServiceCapabilitiesState>(() =>
    hasAgentServiceCapabilitiesEndpoint()
      ? {
          resolved: false,
          ...DEFAULT_AGENT_SERVICE_CAPABILITIES,
        }
      : DEFAULT_AGENT_SERVICE_CAPABILITIES_STATE
  );

  useEffect(() => {
    if (!hasAgentServiceCapabilitiesEndpoint()) return undefined;

    let isMounted = true;
    const controller = new AbortController();

    void fetchAgentServiceCapabilities(controller.signal)
      .then((nextCapabilities) => {
        if (!isMounted) return;
        setCapabilities({
          resolved: true,
          ...nextCapabilities,
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        if (error instanceof Error && error.name === "AbortError") return;
        setCapabilities(DEFAULT_AGENT_SERVICE_CAPABILITIES_STATE);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  return (
    <AgentServiceCapabilitiesContext.Provider value={capabilities}>
      {children}
    </AgentServiceCapabilitiesContext.Provider>
  );
}

