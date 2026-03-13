import { createApp } from "./app.ts";
import fs from "node:fs";
import path from "node:path";
import { formatStubEvent } from "./integrations/feishu/long-connection.ts";

const { agent, runtime } = createApp();

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "help") {
    console.log([
      "Usage:",
      "  npm run cli -- message <senderId> <text>",
      "  npm run cli -- approvals",
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
      skills: runtime.skills.list().map((skill) => skill.name)
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
