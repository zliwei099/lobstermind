import type { AppConfig } from "../../config.ts";
import type { LobsterMindAgent } from "../../agent/agent.ts";
import { FeishuApiClient } from "./api-client.ts";
import { parseFeishuEnvelope } from "./events.ts";
import { FeishuMessageDeduper } from "./message-deduper.ts";
import type { FeishuMessageEnvelope } from "./types.ts";

export class RelayFeishuLongConnectionSession {
  private readonly config: AppConfig;
  private readonly agent: LobsterMindAgent;
  private readonly apiClient: FeishuApiClient;
  private readonly deduper = new FeishuMessageDeduper();
  private socket?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private stopped = false;

  constructor(config: AppConfig, agent: LobsterMindAgent) {
    this.config = config;
    this.agent = agent;
    this.apiClient = new FeishuApiClient(config);
  }

  async start(): Promise<void> {
    if (!this.config.feishuWsUrl) {
      throw new Error("LOBSTERMIND_FEISHU_WS_URL is required when LOBSTERMIND_FEISHU_LONG_CONNECTION_ADAPTER=relay.");
    }

    await this.apiClient.getTenantAccessToken();
    this.stopped = false;
    this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.socket?.close();
    this.socket = undefined;
  }

  private connect(): void {
    if (!this.config.feishuWsUrl) {
      return;
    }

    this.socket = new WebSocket(this.config.feishuWsUrl);
    this.socket.addEventListener("open", () => {
      console.log(`Feishu relay connection opened: ${this.config.feishuWsUrl}`);
    });
    this.socket.addEventListener("message", (event) => {
      void this.handleSocketMessage(String(event.data));
    });
    this.socket.addEventListener("error", () => {
      console.error("Feishu relay connection emitted a websocket error.");
    });
    this.socket.addEventListener("close", () => {
      console.log("Feishu relay connection closed.");
      this.socket = undefined;
      if (!this.stopped) {
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, 3_000);
      }
    });
  }

  private async handleSocketMessage(data: string): Promise<void> {
    const payload = JSON.parse(data) as FeishuMessageEnvelope;
    if (!this.deduper.shouldProcess(payload.event?.message?.message_id)) {
      return;
    }

    const parsed = parseFeishuEnvelope(payload);
    if (!parsed) {
      return;
    }

    if (parsed.kind === "control") {
      this.socket?.send(parsed.responseText);
      return;
    }

    if (parsed.kind === "unsupported") {
      await this.apiClient.sendTextReply(parsed.replyTarget, parsed.reason);
      return;
    }

    const response = await this.agent.handleMessage(parsed.message);
    await this.apiClient.sendTextReply(parsed.replyTarget, response.text);
  }
}
