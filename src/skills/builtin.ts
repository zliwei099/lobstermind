import { formatApprovals, formatAudits, formatCapabilities, formatMemories, formatSkills, submitCapability } from "../agent/helpers.ts";
import { parseActionRequest, parseAppleScriptAction, parseOpenUrlAction, parseShellAction } from "../agent/parser.ts";
import type { Skill } from "./skill.ts";

export function createBuiltinSkills(): Skill[] {
  const help: Skill = {
    name: "help",
    description: "Show the supported commands.",
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

  const capabilities: Skill = {
    name: "capabilities",
    description: "List capability protocol operations and their profiles.",
    examples: ["/capabilities"],
    async handle({ runtime }) {
      return {
        text: formatCapabilities(runtime)
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
    description: "Submit a structured shell execution request through the capability executor.",
    examples: ["/run ls -la", "/run echo \"hello world\""],
    async handle({ runtime, message, args }) {
      const request = parseShellAction(args);
      if (!request) {
        return { text: "Usage: /run <command>" };
      }
      return submitCapability(runtime, message.senderId, request);
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
      return submitCapability(runtime, message.senderId, {
        capability: "desktop.open_app",
        input: {
          appName: args
        },
        requestedProfile: "desktop-safe",
        metadata: {
          sourceCommand: "/open-app"
        }
      });
    }
  };

  const openUrl: Skill = {
    name: "open-url",
    description: "Open a URL in the default browser through the capability executor.",
    examples: ["/open-url https://openai.com"],
    async handle({ runtime, message, args }) {
      const request = parseOpenUrlAction(args);
      if (!request) {
        return { text: "Usage: /open-url <https://...>" };
      }
      return submitCapability(runtime, message.senderId, request);
    }
  };

  const appleScript: Skill = {
    name: "applescript",
    description: "Run AppleScript through the dangerous capability profile.",
    examples: ['/applescript tell application "Finder" to activate'],
    async handle({ runtime, message, args }) {
      const request = parseAppleScriptAction(args);
      if (!request) {
        return { text: "Usage: /applescript <script>" };
      }
      return submitCapability(runtime, message.senderId, request);
    }
  };

  const action: Skill = {
    name: "action",
    description: "Submit a raw capability request as JSON.",
    examples: [
      '/action {"capability":"fs.read","input":{"path":"README.md"}}',
      '/action {"capability":"os.frontmost_app","input":{}}'
    ],
    async handle({ runtime, message, args }) {
      const request = parseActionRequest(args);
      if (!request) {
        return { text: "Usage: /action <json-request>" };
      }
      return submitCapability(runtime, message.senderId, request);
    }
  };

  const approvals: Skill = {
    name: "approvals",
    description: "List recent approval requests.",
    examples: ["/approvals"],
    async handle({ runtime }) {
      return {
        text: formatApprovals(runtime, runtime.approvals.list())
      };
    }
  };

  const audits: Skill = {
    name: "audits",
    description: "List recent audit entries.",
    examples: ["/audits"],
    async handle({ runtime }) {
      return {
        text: formatAudits(runtime, runtime.audits.list())
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
        text: `Approved and executed ${args}.\n${result.output}`.trim(),
        data: result.data
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

  return [help, skills, capabilities, remember, memories, run, openApp, openUrl, appleScript, action, approvals, audits, approve, reject];
}
