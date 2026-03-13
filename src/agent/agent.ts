import { submitCapability } from "./helpers.ts";
import { planNaturalLanguage } from "./planner.ts";
import { parseCommand } from "./parser.ts";
import type { AgentRuntime } from "./runtime.ts";
import type { AgentMessage, AgentResponse } from "../types.ts";

export class LobsterMindAgent {
  runtime: AgentRuntime;

  constructor(runtime: AgentRuntime) {
    this.runtime = runtime;
  }

  async handleMessage(message: AgentMessage): Promise<AgentResponse> {
    const command = parseCommand(message.text);
    if (command) {
      const skill = this.runtime.skills.get(command.name);
      if (!skill) {
        return {
          text: `Unknown command "/${command.name}". Try /help.`
        };
      }

      return skill.handle({
        runtime: this.runtime,
        message,
        args: command.args
      });
    }

    const planned = planNaturalLanguage(message.text);
    if (planned.kind === "clarification") {
      return {
        text: planned.text
      };
    }
    if (planned.kind === "request") {
      return submitCapability(this.runtime, message.senderId, planned.request);
    }

    const related = this.runtime.memory.search(message.text, message.senderId);
    if (related.length === 0) {
      return {
        text: "I can handle slash commands plus common natural-language intents for files, screenshots, apps, URLs, and processes. Try /help."
      };
    }
    return {
      text: `Related memories:\n${related.map((entry) => `- ${entry.text}`).join("\n")}`
    };
  }
}
