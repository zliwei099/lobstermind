import { loadConfig } from "./config.ts";
import { FileMemoryStore } from "./memory/file-memory-store.ts";
import { SkillRegistry } from "./skills/skill-registry.ts";
import { createBuiltinSkills } from "./skills/builtin.ts";
import { ApprovalStore } from "./executor/approval-store.ts";
import { LocalShellAdapter } from "./executor/adapters/local-shell-adapter.ts";
import { MacOpenAppAdapter } from "./executor/adapters/mac-open-app-adapter.ts";
import { MacOpenUrlAdapter } from "./executor/adapters/mac-open-url-adapter.ts";
import { MacAppleScriptAdapter } from "./executor/adapters/mac-applescript-adapter.ts";
import { ComputerActionExecutor } from "./executor/executor.ts";
import { LobsterMindAgent } from "./agent/agent.ts";
import type { AgentRuntime } from "./agent/runtime.ts";

export function createApp() {
  const config = loadConfig();
  const memory = new FileMemoryStore(config.dataDir);
  const approvals = new ApprovalStore(config.dataDir);
  const skills = new SkillRegistry();
  const executor = new ComputerActionExecutor(
    config.approvalMode,
    approvals,
    new LocalShellAdapter(config.shellAllowlist, config.shellTimeoutMs),
    new MacOpenAppAdapter(),
    new MacOpenUrlAdapter(),
    new MacAppleScriptAdapter()
  );

  const runtime: AgentRuntime = {
    config,
    memory,
    skills,
    approvals,
    executor
  };

  for (const skill of createBuiltinSkills()) {
    skills.register(skill);
  }

  const agent = new LobsterMindAgent(runtime);

  return {
    config,
    runtime,
    agent
  };
}
