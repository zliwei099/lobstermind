import type { AuditEntry, ApprovalRequest, CapabilityRequest } from "../executor/types.ts";
import type { MemoryEntry } from "../memory/memory-store.ts";
import type { Skill } from "../skills/skill.ts";
import type { AgentRuntime } from "./runtime.ts";

export function formatSkills(skills: Skill[]): string {
  return skills
    .map((skill) => `- /${skill.name}: ${skill.description}`)
    .join("\n");
}

export function formatCapabilities(runtime: AgentRuntime): string {
  return runtime.capabilities
    .list()
    .map((capability) => {
      const profiles = capability.supportedProfiles.join(", ");
      return `- ${capability.id}: ${capability.description} [profiles: ${profiles}]`;
    })
    .join("\n");
}

export function formatMemories(entries: MemoryEntry[]): string {
  if (entries.length === 0) {
    return "No memories saved yet.";
  }
  return entries
    .slice(0, 10)
    .map((entry) => `- [${entry.id}] ${entry.text} (${entry.createdAt})`)
    .join("\n");
}

export function formatAction(runtime: AgentRuntime, request: CapabilityRequest): string {
  const capability = runtime.capabilities.get(request.capability);
  if (!capability) {
    return `${request.capability} ${JSON.stringify(request.input)}`;
  }
  return capability.summarize(request);
}

export function formatApprovals(runtime: AgentRuntime, items: ApprovalRequest[]): string {
  if (items.length === 0) {
    return "No approval records.";
  }
  return items
    .slice(0, 10)
    .map((item) => {
      const description = formatAction(runtime, item.request);
      return `- [${item.id}] ${item.status} ${item.capability} (${item.profile}, ${item.risk}) -> ${description}`;
    })
    .join("\n");
}

export function formatAudits(runtime: AgentRuntime, items: AuditEntry[]): string {
  if (items.length === 0) {
    return "No audit entries.";
  }
  return items
    .slice(0, 10)
    .map((item) => {
      const result = item.result ? ` result=${item.result.ok ? "ok" : "fail"}` : "";
      return `- [${item.id}] ${item.event} ${item.capability} (${item.profile}, ${item.risk}) -> ${formatAction(runtime, item.request)}${result}`;
    })
    .join("\n");
}
