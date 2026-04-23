import { createContext, useContext } from "react";
import {
  DEFAULT_AGENT_SERVICE_CAPABILITIES,
  type AgentServiceCapabilities,
} from "@/lib/agent-service-capabilities";

export interface AgentServiceCapabilitiesState extends AgentServiceCapabilities {
  resolved: boolean;
}

export const DEFAULT_AGENT_SERVICE_CAPABILITIES_STATE: AgentServiceCapabilitiesState = Object.freeze({
  resolved: true,
  ...DEFAULT_AGENT_SERVICE_CAPABILITIES,
});

export const AgentServiceCapabilitiesContext = createContext<AgentServiceCapabilitiesState>(
  DEFAULT_AGENT_SERVICE_CAPABILITIES_STATE,
);

export function useAgentServiceCapabilities() {
  return useContext(AgentServiceCapabilitiesContext);
}

