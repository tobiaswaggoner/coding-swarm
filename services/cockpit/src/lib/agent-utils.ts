// Agent types derived from addressee pattern
export type AgentType = "red" | "green" | "blue";

export function getAgentType(addressee: string): AgentType {
  if (addressee.startsWith("project-mgr-")) {
    return "green";
  }
  if (addressee.startsWith("blue-") || addressee.startsWith("executive-")) {
    return "blue";
  }
  // Default: worker-* or any other pattern = Red Agent
  return "red";
}

export const agentBorderColors: Record<AgentType, string> = {
  red: "border-l-red-500",
  green: "border-l-green-500",
  blue: "border-l-blue-500",
};
