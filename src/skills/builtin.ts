import { parseAppleScriptAction, parseOpenUrlAction, parseShellAction } from "../agent/parser.ts";
import { formatAction, formatApprovals, formatMemories, formatSkills } from "../agent/helpers.ts";
import type { Skill } from "./skill.ts";

export function createBuiltinSkills(): Skill[] {
  const help: Skill = {
    name: "help",
    description: "Show the supported MVP commands.",
    examples: ["/help"],
    async handle({ runtime }) {
      return {
        text: [
          "Commands:",
          formatSkills(runtime.skills.list())
        ].join("\n")
      };
    }
  };

  const skills: Skill = {
    name: "skills",
    description: "List registered skills.",
    examples: ["/skills"],
    async handle({ runtime }) {
      return {
        text: formatSkills(runtime.skills.list())
      };
    }
  };

  const remember: Skill = {
    name: "remember",
    description: "Persist a memory note for the sender.",
    examples: ["/remember buy oat milk"],
    async handle({ runtime, message, args }) {
      if (!args) {
        return { text: "Usage: /remember <text>" };
      }
      const saved = runtime.memory.add({
        senderId: message.senderId,
        text: args
      });
      return {
        text: `Saved memory ${saved.id}: ${saved.text}`
      };
    }
  };

  const memories: Skill = {
    name: "memories",
    description: "List recent memories or search them by keyword.",
    examples: ["/memories", "/memories lunch"],
    async handle({ runtime, message, args }) {
      const entries = args
        ? runtime.memory.search(args, message.senderId)
        : runtime.memory.list(message.senderId);
      return {
        text: formatMemories(entries)
      };
    }
  };

  const run: Skill = {
    name: "run",
    description: "Submit a shell command through the executor layer.",
    examples: ["/run ls -la"],
    async handle({ runtime, message, args }) {
      const action = parseShellAction(args);
      if (!action) {
        return { text: "Usage: /run <command>" };
      }
      const decision = await runtime.executor.submit(message.senderId, action);
      if (decision.state === "pending_approval" && decision.approval) {
        return {
          text: `Approval required for ${formatAction(action)}.\nApproval ID: ${decision.approval.id}\nReason: ${decision.approval.reason}`
        };
      }
      return {
        text: `Executed ${formatAction(action)}.\n${decision.result?.output ?? ""}`.trim()
      };
    }
  };

  const openApp: Skill = {
    name: "open-app",
    description: "Request opening a desktop app by name.",
    examples: ["/open-app Safari"],
    async handle({ runtime, message, args }) {
      if (!args) {
        return { text: "Usage: /open-app <app name>" };
      }
      const action = {
        type: "desktop.open_app" as const,
        appName: args
      };
      const decision = await runtime.executor.submit(message.senderId, action);
      if (decision.state === "pending_approval" && decision.approval) {
        return {
          text: `Approval required for ${formatAction(action)}.\nApproval ID: ${decision.approval.id}\nReason: ${decision.approval.reason}`
        };
      }
      return {
        text: decision.result?.output ?? `Executed ${formatAction(action)}`
      };
    }
  };

  const openUrl: Skill = {
    name: "open-url",
    description: "Open a URL in the default browser through the executor layer.",
    examples: ["/open-url https://openai.com"],
    async handle({ runtime, message, args }) {
      const action = parseOpenUrlAction(args);
      if (!action) {
        return { text: "Usage: /open-url <https://...>" };
      }
      const decision = await runtime.executor.submit(message.senderId, action);
      if (decision.state === "pending_approval" && decision.approval) {
        return {
          text: `Approval required for ${formatAction(action)}.\nApproval ID: ${decision.approval.id}\nReason: ${decision.approval.reason}`
        };
      }
      return {
        text: decision.result?.output ?? `Executed ${formatAction(action)}`
      };
    }
  };

  const appleScript: Skill = {
    name: "applescript",
    description: "Run AppleScript only after explicit approval.",
    examples: ['/applescript tell application "Finder" to activate'],
    async handle({ runtime, message, args }) {
      const action = parseAppleScriptAction(args);
      if (!action) {
        return { text: "Usage: /applescript <script>" };
      }
      const decision = await runtime.executor.submit(message.senderId, action);
      if (decision.state === "pending_approval" && decision.approval) {
        return {
          text: `Approval required for ${formatAction(action)}.\nApproval ID: ${decision.approval.id}\nReason: ${decision.approval.reason}`
        };
      }
      return {
        text: decision.result?.output ?? `Executed ${formatAction(action)}`
      };
    }
  };

  const approvals: Skill = {
    name: "approvals",
    description: "List recent approval requests.",
    examples: ["/approvals"],
    async handle({ runtime }) {
      return {
        text: formatApprovals(runtime.approvals.list())
      };
    }
  };

  const approve: Skill = {
    name: "approve",
    description: "Approve and execute a pending request.",
    examples: ["/approve apr_123"],
    async handle({ runtime, args }) {
      if (!args) {
        return { text: "Usage: /approve <approval-id>" };
      }
      const result = await runtime.executor.approve(args);
      if (!result) {
        return { text: `No pending approval found for ${args}.` };
      }
      return {
        text: `Approved and executed ${args}.\n${result.output}`.trim()
      };
    }
  };

  const reject: Skill = {
    name: "reject",
    description: "Reject a pending request.",
    examples: ["/reject apr_123"],
    async handle({ runtime, args }) {
      if (!args) {
        return { text: "Usage: /reject <approval-id>" };
      }
      const record = runtime.executor.reject(args);
      if (!record) {
        return { text: `No pending approval found for ${args}.` };
      }
      return {
        text: `Rejected ${args}.`
      };
    }
  };

  return [help, skills, remember, memories, run, openApp, openUrl, appleScript, approvals, approve, reject];
}
