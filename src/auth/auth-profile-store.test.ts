import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AuthProfileStore } from "./auth-profile-store.ts";

test("auth profile store persists provider defaults", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lobstermind-auth-"));

  try {
    const store = new AuthProfileStore(tempDir);
    store.upsert({
      id: "openai-default",
      provider: "openai",
      mode: "api_key",
      label: "Primary OpenAI key",
      apiKey: "test-key"
    });
    store.setDefaultProfile("openai", "openai-default");

    const reloaded = new AuthProfileStore(tempDir);
    assert.equal(reloaded.getDefaultProfile("openai")?.id, "openai-default");
    assert.equal(reloaded.read().defaultsByProvider.openai, "openai-default");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
