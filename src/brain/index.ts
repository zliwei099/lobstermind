import type { AppConfig } from "../config.ts";
import type { CapabilityRegistry } from "../executor/capability-registry.ts";
import { CodexCliBridgeProvider } from "./codex-provider.ts";
import { MockProvider } from "./mock-provider.ts";
import { ToolCallingPlannerRuntime } from "./planner-runtime.ts";
import type { Brain, PlannerProvider, PlannerRuntime } from "./types.ts";

export function createPlannerRuntime(config: AppConfig, capabilities: CapabilityRegistry): PlannerRuntime | undefined {
  if (!config.brainEnabled) {
    return undefined;
  }

  let provider: PlannerProvider;
  if (config.brainProvider === "mock") {
    provider = new MockProvider();
  } else {
    provider = new CodexCliBridgeProvider({
      command: config.brainCodexCommand,
      model: config.brainModel,
      workspaceRoot: config.workspaceRoot
    });
  }

  return new ToolCallingPlannerRuntime({
    provider,
    capabilities
  });
}

export function createBrain(config: AppConfig, capabilities: CapabilityRegistry): Brain | undefined {
  return createPlannerRuntime(config, capabilities);
}
