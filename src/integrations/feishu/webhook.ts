import type { AgentMessage } from "../../types.ts";
import { parseFeishuEnvelope } from "./events.ts";
import type { FeishuMessageEnvelope } from "./types.ts";

type FeishuWebhookPayload = FeishuMessageEnvelope;

export function verifyFeishuToken(payload: FeishuWebhookPayload, expected?: string): boolean {
  if (!expected) {
    return true;
  }
  return payload.header?.token === expected;
}

export function parseFeishuMessage(payload: FeishuWebhookPayload): AgentMessage {
  const parsed = parseFeishuEnvelope(payload);
  if (!parsed || parsed.kind !== "message") {
    return {
      channel: "feishu",
      senderId: "unknown-feishu-user",
      text: "",
      raw: payload
    };
  }

  return parsed.message;
}
