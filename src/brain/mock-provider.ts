import type { PlannerEnvelope, PlannerProvider, PlannerRuntimeRequest } from "./types.ts";

export class MockProvider implements PlannerProvider {
  readonly descriptor = {
    id: "mock",
    label: "Mock planner provider",
    transport: "mock",
    experimental: false,
    supportsToolCalling: false
  } as const;

  async plan(request: PlannerRuntimeRequest): Promise<PlannerEnvelope> {
    return {
      version: "planner-envelope.v1",
      provider: this.descriptor,
      traceId: request.context.traceId,
      decision: {
        kind: "clarification",
        clarification: {
          text: "The mock planner provider is enabled. Set LOBSTERMIND_BRAIN_PROVIDER=codex-cli to use the experimental Codex CLI bridge."
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
