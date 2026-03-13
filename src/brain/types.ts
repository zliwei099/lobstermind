import type { CapabilityRequest } from "../executor/types.ts";
import type { PlannerRuntimeApiKind, NormalizedProviderId } from "./runtime-target.ts";

export interface Clarification {
  text: string;
}

export interface Refusal {
  text: string;
  reason?: string;
}

export interface Unsupported {
  text: string;
  reason?: string;
}

export interface JsonSchema {
  [key: string]: unknown;
}

export interface PlannerToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  supportedProfiles: string[];
  defaultProfile: string;
}

export interface PlannerToolCatalog {
  version: "planner-tools.v1";
  items: PlannerToolDefinition[];
}

export interface PlannerRequestContext {
  traceId: string;
}

export interface PlannerRuntimeRequest {
  intent: string;
  toolCatalog: PlannerToolCatalog;
  context: PlannerRequestContext;
}

export type PlannerDecision =
  | {
      kind: "request";
      request: CapabilityRequest;
    }
  | {
      kind: "clarification";
      clarification: Clarification;
    }
  | {
      kind: "refusal";
      refusal: Refusal;
    }
  | {
      kind: "unsupported";
      unsupported: Unsupported;
    };

export interface PlannerProviderDescriptor {
  id: string;
  label: string;
  transport: "mock" | "cli-bridge" | "native-runtime";
  experimental: boolean;
  supportsToolCalling: boolean;
  providerId: NormalizedProviderId;
  modelRef: string;
  runtimeApiKind: PlannerRuntimeApiKind;
}

export interface PlannerDiagnostic {
  level: "info" | "warning" | "error";
  code: string;
  message: string;
}

export interface PlannerEnvelope {
  version: "planner-envelope.v1";
  provider: PlannerProviderDescriptor;
  traceId: string;
  decision: PlannerDecision;
  diagnostics: PlannerDiagnostic[];
  rawOutput?: unknown;
}

export interface PlannerProvider {
  readonly descriptor: PlannerProviderDescriptor;
  plan(request: PlannerRuntimeRequest): Promise<PlannerEnvelope>;
}

export interface PlannerRuntime {
  readonly toolCatalog: PlannerToolCatalog;
  readonly tools: PlannerToolDefinition[];
  plan(intent: string): Promise<PlannerDecision>;
  inspect(intent: string): Promise<PlannerEnvelope>;
}

export type BrainPlanResult = PlannerDecision;
export type Provider = PlannerProvider;
export type Brain = PlannerRuntime;
