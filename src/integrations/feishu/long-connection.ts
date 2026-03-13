import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "../../config.ts";
import type { LobsterMindAgent } from "../../agent/agent.ts";
import type { AgentResponse } from "../../types.ts";
import { formatStubEvent, parseFeishuEnvelope } from "./events.ts";
import { OfficialFeishuLongConnectionSession } from "./official-long-connection.ts";
import { RelayFeishuLongConnectionSession } from "./relay-long-connection.ts";
import type { FeishuMessageEnvelope } from "./types.ts";

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
    const parsed = parseFeishuEnvelope(payload);
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

    if (parsed.kind === "unsupported") {
      this.appendStubOutbox({
        type: "unsupported",
        target: parsed.replyTarget,
        text: parsed.reason,
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
  if (config.feishuLongConnectionAdapter === "relay") {
    return new RelayFeishuLongConnectionSession(config, agent);
  }
  return new OfficialFeishuLongConnectionSession(config, agent);
}

export async function handleFeishuInbound(
  payload: FeishuMessageEnvelope,
  agent: LobsterMindAgent
): Promise<AgentResponse | undefined> {
  const parsed = parseFeishuEnvelope(payload);
  if (!parsed || parsed.kind !== "message") {
    return undefined;
  }
  return agent.handleMessage(parsed.message);
}
