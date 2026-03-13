import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "../../config.ts";
import type { LobsterMindAgent } from "../../agent/agent.ts";
import type { AgentMessage, AgentResponse } from "../../types.ts";

interface FeishuSenderId {
  open_id?: string;
  user_id?: string;
}

interface FeishuMessageEnvelope {
  type?: string;
  challenge?: string;
  header?: {
    event_type?: string;
    token?: string;
  };
  event?: {
    sender?: {
      sender_id?: FeishuSenderId;
    };
    message?: {
      message_id?: string;
      chat_id?: string;
      message_type?: string;
      content?: string;
    };
  };
}

interface FeishuReplyTarget {
  openId?: string;
  userId?: string;
  messageId?: string;
  chatId?: string;
}

interface ParsedFeishuEvent {
  kind: "message";
  message: AgentMessage;
  replyTarget: FeishuReplyTarget;
  raw: FeishuMessageEnvelope;
}

interface ControlFeishuEvent {
  kind: "control";
  responseText: string;
}

type ParsedEvent = ParsedFeishuEvent | ControlFeishuEvent | undefined;

export interface FeishuLongConnectionSession {
  start(): Promise<void>;
  stop(): Promise<void>;
}

function ensureFile(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "", "utf8");
  }
}

function parseTextContent(content?: string): string {
  if (!content) {
    return "";
  }
  try {
    const parsed = JSON.parse(content) as { text?: string };
    return parsed.text ?? "";
  } catch {
    return content;
  }
}

function parseFeishuEvent(payload: FeishuMessageEnvelope): ParsedEvent {
  if (payload.challenge) {
    return {
      kind: "control",
      responseText: payload.challenge
    };
  }

  if (payload.type === "ping") {
    return {
      kind: "control",
      responseText: "pong"
    };
  }

  const content = parseTextContent(payload.event?.message?.content);
  if (!content) {
    return undefined;
  }

  return {
    kind: "message",
    message: {
      channel: "feishu",
      senderId:
        payload.event?.sender?.sender_id?.open_id ||
        payload.event?.sender?.sender_id?.user_id ||
        "unknown-feishu-user",
      text: content,
      raw: payload
    },
    replyTarget: {
      openId: payload.event?.sender?.sender_id?.open_id,
      userId: payload.event?.sender?.sender_id?.user_id,
      messageId: payload.event?.message?.message_id,
      chatId: payload.event?.message?.chat_id
    },
    raw: payload
  };
}

async function requestTenantAccessToken(config: AppConfig): Promise<string> {
  if (!config.feishuAppId || !config.feishuAppSecret) {
    throw new Error("LOBSTERMIND_FEISHU_APP_ID and LOBSTERMIND_FEISHU_APP_SECRET are required for real long-connection mode.");
  }

  const response = await fetch(`${config.feishuApiBaseUrl}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      app_id: config.feishuAppId,
      app_secret: config.feishuAppSecret
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Feishu tenant access token: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    code?: number;
    msg?: string;
    tenant_access_token?: string;
  };

  if (payload.code !== 0 || !payload.tenant_access_token) {
    throw new Error(`Feishu token request failed: ${payload.msg ?? "unknown error"}`);
  }

  return payload.tenant_access_token;
}

async function sendFeishuTextReply(config: AppConfig, target: FeishuReplyTarget, text: string): Promise<void> {
  const token = await requestTenantAccessToken(config);
  const receiveId = target.openId || target.userId;
  if (!receiveId) {
    throw new Error("Cannot reply to Feishu event without an open_id or user_id.");
  }

  const response = await fetch(`${config.feishuApiBaseUrl}/im/v1/messages?receive_id_type=${target.openId ? "open_id" : "user_id"}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      receive_id: receiveId,
      msg_type: "text",
      content: JSON.stringify({ text })
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to send Feishu reply: ${response.status} ${response.statusText}`);
  }
}

class StubFeishuLongConnectionSession implements FeishuLongConnectionSession {
  config: AppConfig;
  agent: LobsterMindAgent;
  timer?: NodeJS.Timeout;
  cursor = 0;

  constructor(config: AppConfig, agent: LobsterMindAgent) {
    this.config = config;
    this.agent = agent;
  }

  async start(): Promise<void> {
    ensureFile(this.config.feishuStubInboxPath);
    ensureFile(this.config.feishuStubOutboxPath);

    this.timer = setInterval(() => {
      void this.pollOnce();
    }, this.config.feishuStubPollMs);

    await this.pollOnce();
    console.log(`Feishu long-connection stub watching ${this.config.feishuStubInboxPath}`);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async pollOnce(): Promise<void> {
    const raw = fs.readFileSync(this.config.feishuStubInboxPath, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);

    while (this.cursor < lines.length) {
      const line = lines[this.cursor];
      this.cursor += 1;

      try {
        const payload = JSON.parse(line) as FeishuMessageEnvelope;
        await this.handleEvent(payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.appendStubOutbox({
          type: "error",
          text: message,
          receivedAt: new Date().toISOString()
        });
      }
    }
  }

  async handleEvent(payload: FeishuMessageEnvelope): Promise<void> {
    const parsed = parseFeishuEvent(payload);
    if (!parsed) {
      return;
    }

    if (parsed.kind === "control") {
      this.appendStubOutbox({
        type: "control",
        text: parsed.responseText,
        receivedAt: new Date().toISOString()
      });
      return;
    }

    const response = await this.agent.handleMessage(parsed.message);
    this.appendStubOutbox({
      type: "reply",
      target: parsed.replyTarget,
      text: response.text,
      data: response.data,
      receivedAt: new Date().toISOString()
    });
  }

  appendStubOutbox(payload: unknown): void {
    fs.appendFileSync(this.config.feishuStubOutboxPath, `${JSON.stringify(payload)}\n`, "utf8");
  }
}

class RealFeishuLongConnectionSession implements FeishuLongConnectionSession {
  config: AppConfig;
  agent: LobsterMindAgent;
  socket?: WebSocket;

  constructor(config: AppConfig, agent: LobsterMindAgent) {
    this.config = config;
    this.agent = agent;
  }

  async start(): Promise<void> {
    if (!this.config.feishuWsUrl) {
      throw new Error("LOBSTERMIND_FEISHU_WS_URL is required for real long-connection mode.");
    }

    await requestTenantAccessToken(this.config);

    this.socket = new WebSocket(this.config.feishuWsUrl);
    this.socket.addEventListener("open", () => {
      console.log(`Feishu long connection opened: ${this.config.feishuWsUrl}`);
    });
    this.socket.addEventListener("message", (event) => {
      void this.handleSocketMessage(String(event.data));
    });
    this.socket.addEventListener("error", () => {
      console.error("Feishu long connection emitted a websocket error.");
    });
    this.socket.addEventListener("close", () => {
      console.log("Feishu long connection closed.");
    });
  }

  async stop(): Promise<void> {
    this.socket?.close();
    this.socket = undefined;
  }

  async handleSocketMessage(data: string): Promise<void> {
    const payload = JSON.parse(data) as FeishuMessageEnvelope;
    const parsed = parseFeishuEvent(payload);
    if (!parsed) {
      return;
    }

    if (parsed.kind === "control") {
      this.socket?.send(parsed.responseText);
      return;
    }

    const response = await this.agent.handleMessage(parsed.message);
    await sendFeishuTextReply(this.config, parsed.replyTarget, response.text);
  }
}

class NoopFeishuLongConnectionSession implements FeishuLongConnectionSession {
  async start(): Promise<void> {
    console.log("Feishu long connection disabled.");
  }

  async stop(): Promise<void> {}
}

export function createFeishuLongConnectionSession(
  config: AppConfig,
  agent: LobsterMindAgent
): FeishuLongConnectionSession {
  if (config.feishuLongConnectionMode === "off") {
    return new NoopFeishuLongConnectionSession();
  }
  if (config.feishuLongConnectionMode === "stub") {
    return new StubFeishuLongConnectionSession(config, agent);
  }
  return new RealFeishuLongConnectionSession(config, agent);
}

export function formatStubEvent(senderId: string, text: string): string {
  return JSON.stringify({
    header: {
      event_type: "im.message.receive_v1"
    },
    event: {
      sender: {
        sender_id: {
          open_id: senderId
        }
      },
      message: {
        message_type: "text",
        content: JSON.stringify({ text })
      }
    }
  });
}

export async function handleFeishuInbound(
  payload: FeishuMessageEnvelope,
  agent: LobsterMindAgent
): Promise<AgentResponse | undefined> {
  const parsed = parseFeishuEvent(payload);
  if (!parsed || parsed.kind !== "message") {
    return undefined;
  }
  return agent.handleMessage(parsed.message);
}
