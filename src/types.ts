export type Channel = "cli" | "feishu" | "http";

export interface AgentMessage {
  channel: Channel;
  senderId: string;
  text: string;
  raw?: unknown;
}

export interface AgentResponse {
  text: string;
  data?: unknown;
}
