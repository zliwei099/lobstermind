import type { AppConfig } from "../config.ts";
import type { CapabilityRegistry } from "../executor/capability-registry.ts";
import { CodexProvider } from "./codex-provider.ts";
import { MockProvider } from "./mock-provider.ts";
import { PlannerBrain } from "./planner-brain.ts";
import type { Brain, Provider } from "./types.ts";

export function createBrain(config: AppConfig, capabilities: CapabilityRegistry): Brain | undefined {
  if (!config.brainEnabled) {
    return undefined;
  }

  let provider: Provider;
  if (config.brainProvider === "mock") {
    provider = new MockProvider();
  } else {
    provider = new CodexProvider({
      command: config.brainCodexCommand,
      model: config.brainModel,
      workspaceRoot: config.workspaceRoot
    });
  }

  return new PlannerBrain({
    provider,
    capabilities
  });
}
