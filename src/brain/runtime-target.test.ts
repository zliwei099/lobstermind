import test from "node:test";
import assert from "node:assert/strict";
import { normalizePlannerRuntimeTarget } from "./runtime-target.ts";

test("normalizes explicit model refs into runtime targets", () => {
  const target = normalizePlannerRuntimeTarget({
    modelRef: "openai/gpt-5.4"
  });

  assert.deepEqual(target, {
    providerId: "openai",
    providerFamily: "openai",
    modelId: "gpt-5.4",
    modelRef: "openai/gpt-5.4",
    runtimeApiKind: "openai-responses",
    runtimeWrapper: {
      transportMode: "native-runtime",
      fastMode: "off",
      payloadNormalizerId: "openai-responses"
    },
    authProfileId: undefined,
    source: "model-ref"
  });
});

test("preserves legacy codex config through normalized target resolution", () => {
  const target = normalizePlannerRuntimeTarget({
    legacyBrainProvider: "codex-cli",
    legacyBrainModel: "gpt-5.4"
  });

  assert.equal(target.providerId, "openai-codex");
  assert.equal(target.providerFamily, "openai");
  assert.equal(target.modelRef, "openai-codex/gpt-5.4");
  assert.equal(target.runtimeApiKind, "experimental-codex-cli-bridge");
  assert.deepEqual(target.runtimeWrapper, {
    transportMode: "cli-bridge",
    fastMode: "off",
    payloadNormalizerId: "experimental-codex-cli-bridge"
  });
  assert.equal(target.source, "legacy-brain");
});

test("rejects incompatible provider and runtime combinations", () => {
  assert.throws(
    () =>
      normalizePlannerRuntimeTarget({
        modelRef: "openai/gpt-5.4",
        runtimeApiKind: "experimental-codex-cli-bridge"
      }),
    /only supports runtime API kind "openai-responses"/
  );
});
