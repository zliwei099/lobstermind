import type { CapabilityRequest } from "../executor/types.ts";

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

export interface PlannerRuntimeRequest {
  intent: string;
  tools: PlannerToolDefinition[];
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

export interface PlannerProvider {
  plan(request: PlannerRuntimeRequest): Promise<PlannerDecision>;
}

export interface PlannerRuntime {
  readonly tools: PlannerToolDefinition[];
  plan(intent: string): Promise<PlannerDecision>;
}

export type BrainPlanResult = PlannerDecision;
export type Provider = PlannerProvider;
export type Brain = PlannerRuntime;
