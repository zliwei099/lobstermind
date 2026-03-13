import test from "node:test";
import assert from "node:assert/strict";
import { CapabilityRegistry } from "../executor/capability-registry.ts";
import type { CapabilityDefinition } from "../executor/capability-registry.ts";
import { ToolCallingPlannerRuntime } from "./planner-runtime.ts";
import type { PlannerEnvelope, PlannerProvider, PlannerRuntimeRequest } from "./types.ts";

function createRegistry(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  const definition: CapabilityDefinition = {
    id: "fs.read",
    description: "Read a file.",
    supportedProfiles: ["readonly"],
    defaultProfile: "readonly",
    summarize: () => "Read a file.",
    evaluatePolicy: () => ({
      status: "allowed",
      profile: "readonly",
      risk: "low",
      reason: "safe"
    }),
    execute: async () => ({
      ok: true,
      output: "ok"
    })
  };
  registry.register(definition);
  return registry;
}

test("planner runtime applies default profile and metadata to valid requests", async () => {
  const descriptor = {
    id: "test",
    label: "Test provider",
    transport: "native-runtime",
    experimental: false,
    supportsToolCalling: true,
    providerId: "openai",
    providerFamily: "openai",
    modelRef: "openai/gpt-5.4",
    runtimeApiKind: "openai-responses",
    runtimeWrapper: {
      transportMode: "native-runtime",
      fastMode: "off",
      payloadNormalizerId: "openai-responses"
    }
  } as const;
  const provider: PlannerProvider = {
    descriptor,
    async plan(request: PlannerRuntimeRequest): Promise<PlannerEnvelope> {
      return {
        version: "planner-envelope.v1",
        provider: descriptor,
        traceId: request.context.traceId,
        decision: {
          kind: "request",
          request: {
            capability: "fs.read",
            input: { path: "README.md" }
          }
        },
        diagnostics: []
      };
    }
  };
  const runtime = new ToolCallingPlannerRuntime({
    provider,
    capabilities: createRegistry()
  });

  const envelope = await runtime.inspect("read the readme");
  assert.equal(envelope.decision.kind, "request");
  if (envelope.decision.kind !== "request") {
    throw new Error("Expected request decision.");
  }
  assert.equal(envelope.decision.request.requestedProfile, "readonly");
  assert.equal(envelope.decision.request.metadata?.sourceCommand, "planner-runtime");
  assert.match(
    envelope.diagnostics.map((entry) => entry.code).join(","),
    /default_profile_applied/
  );
});

test("planner runtime downgrades invalid provider output to unsupported", async () => {
  const descriptor = {
    id: "test",
    label: "Test provider",
    transport: "native-runtime",
    experimental: false,
    supportsToolCalling: true,
    providerId: "openai",
    providerFamily: "openai",
    modelRef: "openai/gpt-5.4",
    runtimeApiKind: "openai-responses",
    runtimeWrapper: {
      transportMode: "native-runtime",
      fastMode: "off",
      payloadNormalizerId: "openai-responses"
    }
  } as const;
  const provider: PlannerProvider = {
    descriptor,
    async plan(request: PlannerRuntimeRequest): Promise<PlannerEnvelope> {
      return {
        version: "planner-envelope.v1",
        provider: descriptor,
        traceId: request.context.traceId,
        decision: {
          kind: "request",
          request: {
            capability: "fs.read",
            input: { path: "README.md" },
            requestedProfile: "dangerous"
          }
        },
        diagnostics: []
      };
    }
  };
  const runtime = new ToolCallingPlannerRuntime({
    provider,
    capabilities: createRegistry()
  });

  const envelope = await runtime.inspect("read the readme");
  assert.equal(envelope.decision.kind, "unsupported");
  if (envelope.decision.kind !== "unsupported") {
    throw new Error("Expected unsupported decision.");
  }
  assert.equal(envelope.decision.unsupported.reason, "invalid_provider_output");
  assert.match(envelope.diagnostics[0]?.message ?? "", /does not support requested profile/);
});
