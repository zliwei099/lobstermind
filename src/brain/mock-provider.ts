import type { PlannerEnvelope, PlannerProvider, PlannerRuntimeRequest } from "./types.ts";

export class MockProvider implements PlannerProvider {
  readonly descriptor = {
    id: "mock",
    label: "Mock planner provider",
    transport: "mock",
    experimental: false,
    supportsToolCalling: false,
    providerId: "mock",
    modelRef: "mock/mock",
    runtimeApiKind: "mock"
  } as const;

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
