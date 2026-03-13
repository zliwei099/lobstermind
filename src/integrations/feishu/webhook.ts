import type { AgentMessage } from "../../types.ts";

interface FeishuWebhookPayload {
  header?: {
    token?: string;
  };
  event?: {
    sender?: {
      sender_id?: {
        open_id?: string;
        user_id?: string;
      };
    };
    message?: {
      content?: string;
    };
  };
}

export function verifyFeishuToken(payload: FeishuWebhookPayload, expected?: string): boolean {
  if (!expected) {
    return true;
  }
  return payload.header?.token === expected;
}

export function parseFeishuMessage(payload: FeishuWebhookPayload): AgentMessage {
  const content = payload.event?.message?.content ?? "{}";
  let text = "";
  try {
    const parsed = JSON.parse(content) as { text?: string };
    text = parsed.text ?? "";
  } catch {
    text = content;
  }

  return {
    channel: "feishu",
    senderId:
      payload.event?.sender?.sender_id?.open_id ||
      payload.event?.sender?.sender_id?.user_id ||
      "unknown-feishu-user",
    text,
    raw: payload
  };
}
