import type {
  FeishuImMessageReceiveEvent,
  FeishuMessageEnvelope,
  FeishuReplyTarget,
  ParsedFeishuEvent
} from "./types.ts";

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

function toReplyTarget(event?: FeishuImMessageReceiveEvent): FeishuReplyTarget {
  return {
    openId: event?.sender?.sender_id?.open_id,
    userId: event?.sender?.sender_id?.user_id,
    messageId: event?.message?.message_id,
    chatId: event?.message?.chat_id
  };
}

export function parseFeishuEnvelope(payload: FeishuMessageEnvelope): ParsedFeishuEvent | undefined {
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

  return parseFeishuMessageReceiveEvent(payload.event, payload);
}

export function parseFeishuMessageReceiveEvent(
  event?: FeishuImMessageReceiveEvent,
  raw: unknown = event
): ParsedFeishuEvent | undefined {
  if (!event?.message) {
    return undefined;
  }

  const replyTarget = toReplyTarget(event);
  const senderId = replyTarget.openId || replyTarget.userId || "unknown-feishu-user";

  if (event.message.message_type !== "text") {
    return {
      kind: "unsupported",
      reason: `Only text messages are supported right now. Received: ${event.message.message_type ?? "unknown"}.`,
      replyTarget,
      raw
    };
  }

  const text = parseTextContent(event.message.content);
  if (!text.trim()) {
    return {
      kind: "unsupported",
      reason: "Empty text messages are not supported.",
      replyTarget,
      raw
    };
  }

  return {
    kind: "message",
    message: {
      channel: "feishu",
      senderId,
      text,
      raw
    },
    replyTarget,
    raw
  };
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
