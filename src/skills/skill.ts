import type { AgentMessage, AgentResponse } from "../types.ts";
import type { AgentRuntime } from "../agent/runtime.ts";

export interface SkillContext {
  runtime: AgentRuntime;
  message: AgentMessage;
  args: string;
}

export interface Skill {
  name: string;
  description: string;
  examples: string[];
  handle(context: SkillContext): Promise<AgentResponse>;
}
