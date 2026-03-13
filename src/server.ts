import http from "node:http";
import { createApp } from "./app.ts";
import { parseFeishuMessage, verifyFeishuToken } from "./integrations/feishu/webhook.ts";
import { handleFeishuInbound } from "./integrations/feishu/long-connection.ts";
import type { AgentMessage } from "./types.ts";

function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

export function createHttpServer(app = createApp()) {
  const { config, runtime, agent } = app;

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: config.feishuBotName,
        approvalMode: config.approvalMode,
        feishuMode: config.feishuMode,
        feishuLongConnectionMode: config.feishuLongConnectionMode,
        feishuLongConnectionAdapter: config.feishuLongConnectionAdapter,
        plannerEnabled: config.plannerEnabled,
        plannerModelRef: config.plannerModelRef,
        plannerRuntimeApiKind: config.plannerRuntimeApiKind,
        plannerTarget: config.plannerTarget,
        plannerAuthProfileId: config.plannerAuthProfileId,
        brainEnabled: config.brainEnabled,
        brainProvider: config.brainProvider,
        brainModel: config.brainModel,
        allowedExecutionProfiles: config.allowedExecutionProfiles,
        authProfiles: runtime.authProfiles.inspect(),
        capabilities: runtime.capabilities.list().map((capability) => capability.id)
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/planner/tools") {
      sendJson(response, 200, {
        plannerEnabled: Boolean(runtime.planner),
        toolCatalog: runtime.planner?.toolCatalog ?? {
          version: "planner-tools.v1",
          items: []
        }
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/planner/plan") {
      if (!runtime.planner) {
        sendJson(response, 404, { error: "Planner runtime is disabled." });
        return;
      }
      const payload = (await readJsonBody(request)) as { intent?: string };
      const intent = payload.intent?.trim();
      if (!intent) {
        sendJson(response, 400, { error: "Missing intent." });
        return;
      }
      const envelope = await runtime.planner.inspect(intent);
      sendJson(response, 200, envelope);
      return;
    }

    if (request.method === "GET" && url.pathname === "/approvals") {
      sendJson(response, 200, { items: runtime.approvals.list() });
      return;
    }

    if (request.method === "GET" && url.pathname === "/audits") {
      sendJson(response, 200, { items: runtime.audits.list() });
      return;
    }

    if (request.method === "POST" && url.pathname.startsWith("/approvals/") && url.pathname.endsWith("/approve")) {
      const id = url.pathname.split("/")[2];
      const result = await runtime.executor.approve(id);
      if (!result) {
        sendJson(response, 404, { error: `No pending approval found for ${id}.` });
        return;
      }
      sendJson(response, 200, { ok: true, output: result.output });
      return;
    }

    if (request.method === "POST" && url.pathname.startsWith("/approvals/") && url.pathname.endsWith("/reject")) {
      const id = url.pathname.split("/")[2];
      const record = runtime.executor.reject(id);
      if (!record) {
        sendJson(response, 404, { error: `No pending approval found for ${id}.` });
        return;
      }
      sendJson(response, 200, { ok: true, record });
      return;
    }

    if (request.method === "POST" && url.pathname === "/agent/messages") {
      const payload = (await readJsonBody(request)) as Partial<AgentMessage>;
      const message: AgentMessage = {
        channel: payload.channel ?? "http",
        senderId: payload.senderId ?? "anonymous",
        text: payload.text ?? "",
        raw: payload.raw
      };
      const agentResponse = await agent.handleMessage(message);
      sendJson(response, 200, agentResponse);
      return;
    }

    if (request.method === "POST" && url.pathname === "/feishu/webhook") {
      const payload = await readJsonBody(request);
      if (!verifyFeishuToken(payload as Parameters<typeof verifyFeishuToken>[0], config.feishuVerificationToken)) {
        sendJson(response, 401, { error: "Invalid Feishu verification token." });
        return;
      }
      const agentResponse = await handleFeishuInbound(
        payload as Parameters<typeof parseFeishuMessage>[0],
        agent
      );
      if (!agentResponse) {
        sendJson(response, 200, { ok: true });
        return;
      }
      sendJson(response, 200, {
        text: agentResponse.text,
        data: agentResponse.data
      });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  });

  return {
    config,
    runtime,
    agent,
    server
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { config, server } = createHttpServer();
  server.listen(config.port, config.host, () => {
    console.log(`LobsterMind listening on http://${config.host}:${config.port}`);
  });
}
