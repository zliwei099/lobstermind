import type { AppConfig } from "../config.ts";
import type { MemoryStore } from "../memory/memory-store.ts";
import { SkillRegistry } from "../skills/skill-registry.ts";
import { ApprovalStore } from "../executor/approval-store.ts";
import { AuditStore } from "../executor/audit-store.ts";
import { CapabilityRegistry } from "../executor/capability-registry.ts";
import { ComputerActionExecutor } from "../executor/executor.ts";
import type { Brain, PlannerRuntime } from "../brain/types.ts";
import { AuthProfileStore } from "../auth/auth-profile-store.ts";

export interface AgentRuntime {
  config: AppConfig;
  authProfiles: AuthProfileStore;
  memory: MemoryStore;
  skills: SkillRegistry;
  approvals: ApprovalStore;
  audits: AuditStore;
  capabilities: CapabilityRegistry;
  executor: ComputerActionExecutor;
  planner?: PlannerRuntime;
  brain?: Brain;
}
