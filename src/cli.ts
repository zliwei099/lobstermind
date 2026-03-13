import { createApp } from "./app.ts";
import fs from "node:fs";
import path from "node:path";
import { formatStubEvent } from "./integrations/feishu/events.ts";

const { agent, runtime } = createApp();

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "help") {
    console.log([
      "Usage:",
      "  npm run cli -- message <senderId> <text>",
      "  npm run cli -- planner-tools",
      "  npm run cli -- planner-plan <text>",
      "  npm run cli -- approvals",
      "  npm run cli -- audits",
      "  npm run cli -- approve <approval-id>",
      "  npm run cli -- reject <approval-id>",
      "  npm run cli -- feishu-stub <senderId> <text>",
      "  npm run cli -- healthcheck"
    ].join("\n"));
    return;
  }

  if (command === "message") {
    const [senderId, ...textParts] = rest;
    const text = textParts.join(" ").trim();
    if (!senderId || !text) {
      throw new Error("Usage: message <senderId> <text>");
    }
    const response = await agent.handleMessage({
      channel: "cli",
      senderId,
      text
    });
    console.log(response.text);
    return;
  }

  if (command === "approvals") {
    console.log(JSON.stringify(runtime.approvals.list(), null, 2));
    return;
  }

  if (command === "planner-tools") {
    console.log(JSON.stringify(runtime.planner?.toolCatalog ?? { version: "planner-tools.v1", items: [] }, null, 2));
    return;
  }

  if (command === "planner-plan") {
    const text = rest.join(" ").trim();
    if (!text) {
      throw new Error("Usage: planner-plan <text>");
    }
    if (!runtime.planner) {
      throw new Error("Planner runtime is disabled.");
    }
    console.log(JSON.stringify(await runtime.planner.inspect(text), null, 2));
    return;
  }

  if (command === "audits") {
    console.log(JSON.stringify(runtime.audits.list(), null, 2));
    return;
  }

  if (command === "approve") {
    const [id] = rest;
    if (!id) {
      throw new Error("Usage: approve <approval-id>");
    }
    const result = await runtime.executor.approve(id);
    if (!result) {
      throw new Error(`No pending approval found for ${id}`);
    }
    console.log(result.output);
    return;
  }

  if (command === "reject") {
    const [id] = rest;
    if (!id) {
      throw new Error("Usage: reject <approval-id>");
    }
    const record = runtime.executor.reject(id);
    if (!record) {
      throw new Error(`No pending approval found for ${id}`);
    }
    console.log(`Rejected ${id}`);
    return;
  }

  if (command === "healthcheck") {
    console.log(JSON.stringify({
      ok: true,
      approvalMode: runtime.config.approvalMode,
      feishuMode: runtime.config.feishuMode,
      feishuLongConnectionMode: runtime.config.feishuLongConnectionMode,
      feishuLongConnectionAdapter: runtime.config.feishuLongConnectionAdapter,
      brainEnabled: runtime.config.brainEnabled,
      brainProvider: runtime.config.brainProvider,
      brainModel: runtime.config.brainModel,
      plannerTools: runtime.planner?.toolCatalog ?? { version: "planner-tools.v1", items: [] },
      allowedExecutionProfiles: runtime.config.allowedExecutionProfiles,
      skills: runtime.skills.list().map((skill) => skill.name),
      capabilities: runtime.capabilities.list().map((capability) => capability.id)
    }, null, 2));
    return;
  }

  if (command === "feishu-stub") {
    const [senderId, ...textParts] = rest;
    const text = textParts.join(" ").trim();
    if (!senderId || !text) {
      throw new Error("Usage: feishu-stub <senderId> <text>");
    }
    fs.mkdirSync(path.dirname(runtime.config.feishuStubInboxPath), { recursive: true });
    fs.appendFileSync(runtime.config.feishuStubInboxPath, `${formatStubEvent(senderId, text)}\n`, "utf8");
    console.log(`Queued stub Feishu event in ${runtime.config.feishuStubInboxPath}`);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
