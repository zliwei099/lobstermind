import type { AgentMessage } from "../../types.ts";

export interface FeishuSenderId {
  open_id?: string;
  user_id?: string;
}

export interface FeishuMessage {
  message_id?: string;
  chat_id?: string;
  message_type?: string;
  content?: string;
}

export interface FeishuEventHeader {
  event_type?: string;
  token?: string;
}

export interface FeishuMessageEnvelope {
  type?: string;
  challenge?: string;
  header?: FeishuEventHeader;
  event?: {
    sender?: {
      sender_id?: FeishuSenderId;
    };
    message?: FeishuMessage;
  };
}

export interface FeishuImMessageReceiveEvent {
  sender?: {
    sender_id?: FeishuSenderId;
  };
  message?: FeishuMessage;
}

export interface FeishuReplyTarget {
  openId?: string;
  userId?: string;
  messageId?: string;
  chatId?: string;
}

export interface ParsedFeishuMessageEvent {
  kind: "message";
  message: AgentMessage;
  replyTarget: FeishuReplyTarget;
  raw: unknown;
}

export interface ParsedFeishuUnsupportedEvent {
  kind: "unsupported";
  reason: string;
  replyTarget: FeishuReplyTarget;
  raw: unknown;
}

export interface ParsedFeishuControlEvent {
  kind: "control";
  responseText: string;
}

export type ParsedFeishuEvent =
  | ParsedFeishuControlEvent
  | ParsedFeishuMessageEvent
  | ParsedFeishuUnsupportedEvent;
