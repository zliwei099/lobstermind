import type { AppConfig } from "../../config.ts";
import type { FeishuReplyTarget } from "./types.ts";

interface TenantAccessTokenResponse {
  code?: number;
  msg?: string;
  tenant_access_token?: string;
  expire?: number;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

export class FeishuApiClient {
  private readonly config: AppConfig;
  private cachedToken?: CachedToken;

  constructor(config: AppConfig) {
    this.config = config;
  }

  async getTenantAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now) {
      return this.cachedToken.value;
    }

    if (!this.config.feishuAppId || !this.config.feishuAppSecret) {
      throw new Error("LOBSTERMIND_FEISHU_APP_ID and LOBSTERMIND_FEISHU_APP_SECRET are required for real Feishu mode.");
    }

    const response = await fetch(`${this.config.feishuApiBaseUrl}/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        app_id: this.config.feishuAppId,
        app_secret: this.config.feishuAppSecret
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Feishu tenant access token: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as TenantAccessTokenResponse;
    if (payload.code !== 0 || !payload.tenant_access_token) {
      throw new Error(`Feishu token request failed: ${payload.msg ?? "unknown error"}`);
    }

    const lifetimeMs = Math.max((payload.expire ?? 7200) - 60, 60) * 1_000;
    this.cachedToken = {
      value: payload.tenant_access_token,
      expiresAt: now + lifetimeMs
    };
    return payload.tenant_access_token;
  }

  async sendTextReply(target: FeishuReplyTarget, text: string): Promise<void> {
    const token = await this.getTenantAccessToken();
    const receiveId = target.chatId || target.openId || target.userId;
    const receiveIdType = target.chatId ? "chat_id" : target.openId ? "open_id" : target.userId ? "user_id" : undefined;

    if (!receiveId || !receiveIdType) {
      throw new Error("Cannot reply to a Feishu event without chat_id, open_id, or user_id.");
    }

    const response = await fetch(`${this.config.feishuApiBaseUrl}/im/v1/messages?receive_id_type=${receiveIdType}`, {
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

    const payload = (await response.json()) as { code?: number; msg?: string };
    if (payload.code !== 0) {
      throw new Error(`Feishu reply request failed: ${payload.msg ?? "unknown error"}`);
    }
  }
}
