import test from "node:test";
import assert from "node:assert/strict";
import { normalizePlannerEnvelope, validatePlannerEnvelope } from "./planning-envelope.ts";
import type { PlannerProviderDescriptor, PlannerRuntimeRequest } from "./types.ts";

const descriptor: PlannerProviderDescriptor = {
  id: "test-provider",
  label: "Test provider",
  transport: "native-runtime",
  experimental: false,
  supportsToolCalling: true
};

const request: PlannerRuntimeRequest = {
  intent: "read README",
  toolCatalog: {
    version: "planner-tools.v1",
    items: [
      {
        name: "fs.read",
        description: "Read a file.",
        inputSchema: { type: "object" },
        supportedProfiles: ["readonly"],
        defaultProfile: "readonly"
      }
    ]
  },
  context: {
    traceId: "trace-123"
  }
};

test("normalizePlannerEnvelope wraps legacy decision payloads", () => {
  const envelope = normalizePlannerEnvelope(
    {
      kind: "request",
      request: {
        capability: "fs.read",
        input: { path: "README.md" }
      }
    },
    descriptor,
    request
  );

  assert.equal(envelope.version, "planner-envelope.v1");
  assert.equal(envelope.traceId, "trace-123");
  assert.equal(envelope.decision.kind, "request");
  if (envelope.decision.kind !== "request") {
    throw new Error("Expected request decision.");
  }
  assert.equal(envelope.decision.request.capability, "fs.read");
});

test("validatePlannerEnvelope rejects unsupported requested profiles", () => {
  const envelope = normalizePlannerEnvelope(
    {
      version: "planner-envelope.v1",
      traceId: "trace-123",
      decision: {
        kind: "request",
        request: {
          capability: "fs.read",
          input: { path: "README.md" },
          requestedProfile: "dangerous"
        }
      }
    },
    descriptor,
    request
  );

  assert.throws(() => validatePlannerEnvelope(envelope, request), /does not support requested profile/);
});
