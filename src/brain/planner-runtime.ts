import type { CapabilityRegistry } from "../executor/capability-registry.ts";
import { randomUUID } from "node:crypto";
import { exportPlannerToolCatalog } from "./tool-schema.ts";
import {
  createUnsupportedEnvelope,
  normalizePlannerEnvelope,
  validatePlannerEnvelope
} from "./planning-envelope.ts";
import type { Brain, PlannerDecision, PlannerEnvelope, PlannerProvider, PlannerToolCatalog, PlannerToolDefinition } from "./types.ts";

interface ToolCallingPlannerRuntimeOptions {
  provider: PlannerProvider;
  capabilities: CapabilityRegistry;
}

export class ToolCallingPlannerRuntime implements Brain {
  private readonly provider: PlannerProvider;
  private readonly capabilities: CapabilityRegistry;
  readonly toolCatalog: PlannerToolCatalog;
  readonly tools: PlannerToolDefinition[];

  constructor(options: ToolCallingPlannerRuntimeOptions) {
    this.provider = options.provider;
    this.capabilities = options.capabilities;
    this.toolCatalog = exportPlannerToolCatalog(options.capabilities);
    this.tools = this.toolCatalog.items;
  }

  async plan(intent: string): Promise<PlannerDecision> {
    const envelope = await this.inspect(intent);
    return envelope.decision;
  }

  async inspect(intent: string): Promise<PlannerEnvelope> {
    const request = {
      intent,
      toolCatalog: this.toolCatalog,
      context: {
        traceId: randomUUID()
      }
    } as const;

    let providerEnvelope: PlannerEnvelope;
    try {
      providerEnvelope = await this.provider.plan(request);
    } catch (error) {
      throw error;
    }

    let envelope: PlannerEnvelope;
    try {
      envelope = validatePlannerEnvelope(
        normalizePlannerEnvelope(providerEnvelope, this.provider.descriptor, request),
        request
      );
    } catch (error) {
      return createUnsupportedEnvelope(
        this.provider.descriptor,
        request,
        "invalid_provider_output",
        error instanceof Error ? error.message : String(error),
        providerEnvelope
      );
    }

    if (envelope.decision.kind !== "request") {
      return envelope;
    }

    const capability = this.capabilities.get(envelope.decision.request.capability);
    if (!capability) {
      return createUnsupportedEnvelope(
        this.provider.descriptor,
        request,
        "provider_returned_unknown_capability",
        `Capability "${envelope.decision.request.capability}" is not registered.`,
        envelope.rawOutput
      );
    }

    return {
      ...envelope,
      decision: {
        kind: "request",
        request: {
          ...envelope.decision.request,
          requestedProfile: envelope.decision.request.requestedProfile ?? capability.defaultProfile,
          metadata: {
            ...envelope.decision.request.metadata,
            sourceCommand: envelope.decision.request.metadata?.sourceCommand || "planner-runtime",
            note: envelope.decision.request.metadata?.note || "Planned by LobsterMind runtime"
          }
        }
      },
      diagnostics: [
        ...envelope.diagnostics,
        ...(envelope.decision.request.requestedProfile
          ? []
          : [
              {
                level: "info" as const,
                code: "default_profile_applied",
                message: `Applied default profile "${capability.defaultProfile}" for capability "${capability.id}".`
              }
            ])
      ]
    };
  }
}
