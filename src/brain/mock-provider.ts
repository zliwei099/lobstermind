import type { PlannerEnvelope, PlannerProvider, PlannerRuntimeRequest } from "./types.ts";
import { createPlannerProviderDescriptor } from "./provider-descriptor.ts";

export class MockProvider implements PlannerProvider {
  readonly descriptor = createPlannerProviderDescriptor({
    id: "mock",
    label: "Mock planner provider",
    experimental: false,
    supportsToolCalling: false,
    target: {
      providerId: "mock",
      providerFamily: "mock",
      modelRef: "mock/mock",
      runtimeApiKind: "mock",
      runtimeWrapper: {
        transportMode: "mock",
        fastMode: "off",
        payloadNormalizerId: "mock"
      }
    }
  });

  async plan(request: PlannerRuntimeRequest): Promise<PlannerEnvelope> {
    return {
      version: "planner-envelope.v1",
      provider: this.descriptor,
      traceId: request.context.traceId,
      decision: {
        kind: "clarification",
        clarification: {
          text: "The mock planner provider is enabled. Set LOBSTERMIND_PLANNER_MODEL_REF=openai-codex/gpt-5.4 to use the experimental Codex CLI bridge."
        }
      },
      diagnostics: [
        {
          level: "info",
          code: "mock_provider",
          message: "Mock provider returned a deterministic clarification response."
        }
      ]
    };
  }
}
