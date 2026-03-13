import type { AppConfig } from "../config.ts";
import type { MemoryStore } from "../memory/memory-store.ts";
import { SkillRegistry } from "../skills/skill-registry.ts";
import { ApprovalStore } from "../executor/approval-store.ts";
import { ComputerActionExecutor } from "../executor/executor.ts";

export interface AgentRuntime {
  config: AppConfig;
  memory: MemoryStore;
  skills: SkillRegistry;
  approvals: ApprovalStore;
  executor: ComputerActionExecutor;
}
