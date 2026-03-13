import type { CapabilityRequest } from "../executor/types.ts";

export interface Clarification {
  text: string;
}

export type BrainPlanResult =
  | {
      kind: "request";
      request: CapabilityRequest;
    }
  | {
      kind: "clarification";
      clarification: Clarification;
    };

export interface Provider {
  complete(prompt: string): Promise<string>;
}

export interface Brain {
  plan(intent: string): Promise<BrainPlanResult>;
}
