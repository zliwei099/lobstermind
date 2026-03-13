import type { ApprovalRequest, ComputerAction } from "../executor/types.ts";
import type { MemoryEntry } from "../memory/memory-store.ts";
import type { Skill } from "../skills/skill.ts";

export function formatSkills(skills: Skill[]): string {
  return skills
    .map((skill) => `- /${skill.name}: ${skill.description}`)
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

export function formatAction(action: ComputerAction): string {
  if (action.type === "shell.command") {
    return `${action.command} ${action.args.join(" ")}`.trim();
  }
  if (action.type === "desktop.open_app") {
    return `open app "${action.appName}"`;
  }
  if (action.type === "browser.open_url") {
    return `open URL "${action.url}"`;
  }
  return `run AppleScript "${action.script}"`;
}

export function formatApprovals(items: ApprovalRequest[]): string {
  if (items.length === 0) {
    return "No approval records.";
  }
  return items
    .slice(0, 10)
    .map((item) => `- [${item.id}] ${item.status} ${item.action.type} (${item.risk}) -> ${formatAction(item.action)}`)
    .join("\n");
}
