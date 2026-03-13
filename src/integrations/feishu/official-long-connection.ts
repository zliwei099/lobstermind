import type { AppConfig } from "../../config.ts";
import type { LobsterMindAgent } from "../../agent/agent.ts";
import { FeishuApiClient } from "./api-client.ts";
import { parseFeishuMessageReceiveEvent } from "./events.ts";
import { FeishuMessageDeduper } from "./message-deduper.ts";
import type { FeishuImMessageReceiveEvent } from "./types.ts";

interface OfficialSdkModule {
  WSClient: new (options: {
    appId: string;
    appSecret: string;
  }) => {
    start(options: {
      eventDispatcher: unknown;
    }): unknown;
    stop?: () => unknown;
  };
  EventDispatcher: new (options?: Record<string, unknown>) => {
    register(handlers: Record<string, (payload: unknown) => unknown>): unknown;
  };
}

export class OfficialFeishuLongConnectionSession {
  private readonly config: AppConfig;
  private readonly agent: LobsterMindAgent;
  private readonly apiClient: FeishuApiClient;
  private readonly deduper = new FeishuMessageDeduper();
  private wsClient?: {
    start(options: {
      eventDispatcher: unknown;
    }): unknown;
    stop?: () => unknown;
  };

  constructor(config: AppConfig, agent: LobsterMindAgent) {
    this.config = config;
    this.agent = agent;
    this.apiClient = new FeishuApiClient(config);
  }

  async start(): Promise<void> {
    if (!this.config.feishuAppId || !this.config.feishuAppSecret) {
      throw new Error("LOBSTERMIND_FEISHU_APP_ID and LOBSTERMIND_FEISHU_APP_SECRET are required for official Feishu long-connection mode.");
    }

    await this.apiClient.getTenantAccessToken();

    let sdk: OfficialSdkModule;
    try {
      sdk = (await import("@larksuiteoapi/node-sdk")) as OfficialSdkModule;
    } catch {
      throw new Error("Official Feishu long-connection mode requires @larksuiteoapi/node-sdk. Run: npm install");
    }

    const dispatcher = new sdk.EventDispatcher({}).register({
      "im.message.receive_v1": (payload: unknown) => {
        void this.handleSdkEvent(payload);
      }
    });

    this.wsClient = new sdk.WSClient({
      appId: this.config.feishuAppId,
      appSecret: this.config.feishuAppSecret
    });

    this.wsClient?.start({ eventDispatcher: dispatcher });
    console.log("Feishu long connection started with the official Node SDK.");
  }

  async stop(): Promise<void> {
    this.wsClient?.stop?.();
    this.wsClient = undefined;
  }

  private async handleSdkEvent(payload: unknown): Promise<void> {
    const event = payload as FeishuImMessageReceiveEvent;
    if (!this.deduper.shouldProcess(event.message?.message_id)) {
      return;
    }

    const parsed = parseFeishuMessageReceiveEvent(event, payload);
    if (!parsed) {
      return;
    }

    if (parsed.kind === "unsupported") {
      await this.apiClient.sendTextReply(parsed.replyTarget, parsed.reason);
      return;
    }

    if (parsed.kind !== "message") {
      return;
    }

    const response = await this.agent.handleMessage(parsed.message);
    await this.apiClient.sendTextReply(parsed.replyTarget, response.text);
  }
}
