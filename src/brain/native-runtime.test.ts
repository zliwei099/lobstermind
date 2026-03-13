import test from "node:test";
import assert from "node:assert/strict";
import { getNativePlannerRuntimeContract } from "./native-runtime.ts";

test("native planner runtime contracts stay explicit placeholders", () => {
  const openai = getNativePlannerRuntimeContract("openai-responses");
  const codex = getNativePlannerRuntimeContract("openai-codex-responses");

  assert.deepEqual(openai, {
    runtimeApiKind: "openai-responses",
    providerId: "openai",
    providerFamily: "openai",
    implementationStatus: "placeholder",
    transport: "native-runtime",
    supportsToolCalling: true,
    supportsFastMode: true,
    wrapperDefaults: {
      transportMode: "native-runtime",
      fastMode: "off",
      payloadNormalizerId: "openai-responses"
    },
    requestPayloadFormat: "OpenAI Responses API tool-calling request payload",
    responsePayloadFormat: "OpenAI Responses API output normalized into planner-envelope.v1",
    payloadNormalizerId: "openai-responses",
    notes: "Placeholder contract only. LobsterMind does not ship a native OpenAI Responses runtime yet."
  });

  assert.equal(codex?.runtimeApiKind, "openai-codex-responses");
  assert.equal(codex?.providerId, "openai-codex");
  assert.equal(codex?.implementationStatus, "placeholder");
  assert.equal(codex?.wrapperDefaults.transportMode, "native-runtime");
  assert.equal(codex?.wrapperDefaults.fastMode, "off");
});
