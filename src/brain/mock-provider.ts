import type { Provider } from "./types.ts";

export class MockProvider implements Provider {
  async complete(): Promise<string> {
    return JSON.stringify({
      action: "clarification",
      clarification: {
        text: "The mock brain is enabled. Set LOBSTERMIND_BRAIN_PROVIDER=codex to use the Codex OAuth planner."
      }
    });
  }
}
