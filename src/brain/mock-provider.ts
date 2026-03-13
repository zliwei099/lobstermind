import type { PlannerDecision, PlannerProvider, PlannerRuntimeRequest } from "./types.ts";

export class MockProvider implements PlannerProvider {
  async plan(_request: PlannerRuntimeRequest): Promise<PlannerDecision> {
    return {
      kind: "clarification",
      clarification: {
        text: "The mock planner provider is enabled. Set LOBSTERMIND_BRAIN_PROVIDER=codex-cli to use the experimental Codex CLI bridge."
      }
    };
  }
}
