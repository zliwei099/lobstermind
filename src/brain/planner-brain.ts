import type { CapabilityRequest } from "../executor/types.ts";
import type { CapabilityRegistry } from "../executor/capability-registry.ts";
import type { Brain, BrainPlanResult, Provider } from "./types.ts";

interface PlannerBrainOptions {
  provider: Provider;
  capabilities: CapabilityRegistry;
}

interface ProviderResponse {
  action: "request" | "clarification";
  request?: CapabilityRequest;
  clarification?: {
    text: string;
  };
}

function sanitizeJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return trimmed;
}

function assertRequestShape(value: ProviderResponse["request"]): CapabilityRequest {
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

export class PlannerBrain implements Brain {
  private readonly provider: Provider;
  private readonly capabilities: CapabilityRegistry;

  constructor(options: PlannerBrainOptions) {
    this.provider = options.provider;
    this.capabilities = options.capabilities;
  }

  async plan(intent: string): Promise<BrainPlanResult> {
    const prompt = this.buildPrompt(intent);
    const raw = await this.provider.complete(prompt);
    const parsed = JSON.parse(sanitizeJson(raw)) as ProviderResponse;

    if (parsed.action === "clarification") {
      const text = parsed.clarification?.text?.trim();
      if (!text) {
        throw new Error("Clarification response is missing text.");
      }
      return {
        kind: "clarification",
        clarification: { text }
      };
    }

    const request = assertRequestShape(parsed.request);
    if (!this.capabilities.get(request.capability)) {
      throw new Error(`Unsupported capability "${request.capability}".`);
    }

    return {
      kind: "request",
      request: {
        ...request,
        metadata: {
          sourceCommand: request.metadata?.sourceCommand || "brain",
          note: request.metadata?.note || "Planned by LobsterMind brain"
        }
      }
    };
  }

  private buildPrompt(intent: string): string {
    const capabilities = this.capabilities.list().map((capability) => ({
      id: capability.id,
      description: capability.description,
      supportedProfiles: capability.supportedProfiles,
      defaultProfile: capability.defaultProfile
    }));

    return [
      "You are LobsterMind's planning brain.",
      "Convert the user's intent into exactly one structured capability request or one clarification question.",
      "You only plan. You never execute commands, browse, or claim an action has been completed.",
      "Return JSON only and follow the provided output schema.",
      "Use only the listed capability ids and keep the request minimal.",
      "If the intent is ambiguous or missing required arguments, return action=clarification.",
      "Prefer the capability's default profile unless the request clearly needs a higher one.",
      "",
      `User intent: ${intent}`,
      "",
      `Available capabilities: ${JSON.stringify(capabilities, null, 2)}`,
      "",
      "Examples:",
      JSON.stringify({
        action: "request",
        request: {
          capability: "fs.read",
          input: { path: "README.md" },
          requestedProfile: "readonly",
          metadata: {
            sourceCommand: "brain",
            note: "Read the requested file"
          }
        }
      }),
      JSON.stringify({
        action: "clarification",
        clarification: {
          text: "Which file should I read?"
        }
      })
    ].join("\n");
  }
}
