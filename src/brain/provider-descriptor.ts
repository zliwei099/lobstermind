import type { PlannerProviderDescriptor } from "./types.ts";
import type { PlannerRuntimeTarget } from "./runtime-target.ts";

export interface CreatePlannerProviderDescriptorOptions {
  id: string;
  label: string;
  experimental: boolean;
  supportsToolCalling: boolean;
  target: Pick<
    PlannerRuntimeTarget,
    "providerId" | "providerFamily" | "modelRef" | "runtimeApiKind" | "runtimeWrapper"
  >;
}

export function createPlannerProviderDescriptor(
  options: CreatePlannerProviderDescriptorOptions
): PlannerProviderDescriptor {
  return {
    id: options.id,
    label: options.label,
    transport: options.target.runtimeWrapper.transportMode,
    experimental: options.experimental,
    supportsToolCalling: options.supportsToolCalling,
    providerId: options.target.providerId,
    providerFamily: options.target.providerFamily,
    modelRef: options.target.modelRef,
    runtimeApiKind: options.target.runtimeApiKind,
    runtimeWrapper: options.target.runtimeWrapper
  };
}
