import type { AppConfig } from "../config.ts";
import { AuthProfileStore } from "../auth/auth-profile-store.ts";
import type { CapabilityRegistry } from "../executor/capability-registry.ts";
import { CodexCliBridgeProvider } from "./codex-provider.ts";
import { MockProvider } from "./mock-provider.ts";
import { getNativePlannerRuntimeContract } from "./native-runtime.ts";
import { ToolCallingPlannerRuntime } from "./planner-runtime.ts";
import { UnavailablePlannerProvider } from "./unavailable-provider.ts";
import type { Brain, PlannerProvider, PlannerRuntime } from "./types.ts";

function resolvePlannerAuthProfile(config: AppConfig, authProfiles: AuthProfileStore) {
  if (config.plannerAuthProfileId) {
    return authProfiles.get(config.plannerAuthProfileId);
  }
  return authProfiles.getDefaultProfile(config.plannerTarget.providerId);
}

export function createPlannerRuntime(
  config: AppConfig,
  capabilities: CapabilityRegistry,
  authProfiles: AuthProfileStore
): PlannerRuntime | undefined {
  if (!config.plannerEnabled) {
    return undefined;
  }

  const authProfile = resolvePlannerAuthProfile(config, authProfiles);
  let provider: PlannerProvider;
  if (config.plannerTarget.runtimeApiKind === "mock") {
    provider = new MockProvider();
  } else if (config.plannerTarget.runtimeApiKind === "experimental-codex-cli-bridge") {
    provider = new CodexCliBridgeProvider({
      command: config.plannerCodexCommand,
      workspaceRoot: config.workspaceRoot,
      target: config.plannerTarget as typeof config.plannerTarget & {
        providerId: "openai-codex";
        runtimeApiKind: "experimental-codex-cli-bridge";
      },
      authProfile
    });
  } else {
    provider = new UnavailablePlannerProvider({
      target: config.plannerTarget,
      authProfile,
      nativeContract: getNativePlannerRuntimeContract(config.plannerTarget.runtimeApiKind)
    });
  }

  return new ToolCallingPlannerRuntime({
    provider,
    capabilities
  });
}

export function createBrain(config: AppConfig, capabilities: CapabilityRegistry): Brain | undefined {
  return createPlannerRuntime(config, capabilities, new AuthProfileStore(config.dataDir));
}
