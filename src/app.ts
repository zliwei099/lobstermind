import { loadConfig } from "./config.ts";
import { FileMemoryStore } from "./memory/file-memory-store.ts";
import { SkillRegistry } from "./skills/skill-registry.ts";
import { createBuiltinSkills } from "./skills/builtin.ts";
import { ApprovalStore } from "./executor/approval-store.ts";
import { AuditStore } from "./executor/audit-store.ts";
import { LocalShellAdapter } from "./executor/adapters/local-shell-adapter.ts";
import { MacOpenAppAdapter } from "./executor/adapters/mac-open-app-adapter.ts";
import { MacOpenUrlAdapter } from "./executor/adapters/mac-open-url-adapter.ts";
import { MacAppleScriptAdapter } from "./executor/adapters/mac-applescript-adapter.ts";
import { LocalFsAdapter } from "./executor/adapters/local-fs-adapter.ts";
import { MacFrontmostAppAdapter } from "./executor/adapters/mac-frontmost-app-adapter.ts";
import { MacScreenshotAdapter } from "./executor/adapters/mac-screenshot-adapter.ts";
import { LocalProcessAdapter } from "./executor/adapters/local-process-adapter.ts";
import { createBuiltinCapabilityRegistry } from "./executor/builtin-capabilities.ts";
import { ComputerActionExecutor } from "./executor/executor.ts";
import { LobsterMindAgent } from "./agent/agent.ts";
import type { AgentRuntime } from "./agent/runtime.ts";
import { createBrain } from "./brain/index.ts";

export function createApp() {
  const config = loadConfig();
  const memory = new FileMemoryStore(config.dataDir);
  const approvals = new ApprovalStore(config.dataDir);
  const audits = new AuditStore(config.dataDir);
  const skills = new SkillRegistry();
  const capabilities = createBuiltinCapabilityRegistry(
    config,
    new LocalShellAdapter(config.shellAllowlist, config.shellTimeoutMs),
    new MacOpenAppAdapter(),
    new MacOpenUrlAdapter(),
    new MacAppleScriptAdapter(),
    new LocalFsAdapter(),
    new MacFrontmostAppAdapter(),
    new MacScreenshotAdapter(config.dataDir),
    new LocalProcessAdapter(config.dataDir, config.shellTimeoutMs)
  );
  const executor = new ComputerActionExecutor(
    config,
    approvals,
    audits,
    capabilities
  );
  const brain = createBrain(config, capabilities);

  const runtime: AgentRuntime = {
    config,
    memory,
    skills,
    approvals,
    audits,
    capabilities,
    executor,
    brain
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
