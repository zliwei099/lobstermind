import type { CapabilityRequest } from "../executor/types.ts";
import type { CapabilityRegistry } from "../executor/capability-registry.ts";
import { exportPlannerTools } from "./tool-schema.ts";
import type { Brain, PlannerDecision, PlannerProvider, PlannerToolDefinition } from "./types.ts";

interface ToolCallingPlannerRuntimeOptions {
  provider: PlannerProvider;
  capabilities: CapabilityRegistry;
}

function assertRequestShape(value: unknown): CapabilityRequest {
  if (!value || typeof value !== "object") {
    throw new Error("Missing capability request object.");
  }
  const request = value as CapabilityRequest;
  if (typeof request.capability !== "string") {
    throw new Error("Capability id must be a string.");
  }
  if (!request.input || typeof request.input !== "object") {
    throw new Error("Capability input must be an object.");
  }
  return request;
}

export class ToolCallingPlannerRuntime implements Brain {
  private readonly provider: PlannerProvider;
  private readonly capabilities: CapabilityRegistry;
  readonly tools: PlannerToolDefinition[];

  constructor(options: ToolCallingPlannerRuntimeOptions) {
    this.provider = options.provider;
    this.capabilities = options.capabilities;
    this.tools = exportPlannerTools(options.capabilities);
  }

  async plan(intent: string): Promise<PlannerDecision> {
    const decision = await this.provider.plan({
      intent,
      tools: this.tools
    });

    if (decision.kind !== "request") {
      return decision;
    }

    const request = assertRequestShape(decision.request);
    if (!this.capabilities.get(request.capability)) {
      return {
        kind: "unsupported",
        unsupported: {
          text: `I cannot use the unsupported capability "${request.capability}".`,
          reason: "provider_returned_unknown_capability"
        }
      };
    }

    return {
      kind: "request",
      request: {
        ...request,
        metadata: {
          sourceCommand: request.metadata?.sourceCommand || "planner-runtime",
          note: request.metadata?.note || "Planned by LobsterMind runtime"
        }
      }
    };
  }
}
