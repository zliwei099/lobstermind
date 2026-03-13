import type { CapabilityRegistry } from "../executor/capability-registry.ts";
import type { CapabilityId } from "../executor/types.ts";
import type { JsonSchema, PlannerToolDefinition } from "./types.ts";

const STRING = { type: "string" } as const;

const CAPABILITY_INPUT_SCHEMAS: Record<CapabilityId, JsonSchema> = {
  "shell.exec": {
    type: "object",
    additionalProperties: false,
    required: ["command", "argv"],
    properties: {
      command: STRING,
      argv: {
        type: "array",
        items: STRING
      },
      cwd: STRING,
      env: {
        type: "object",
        additionalProperties: { type: "string" }
      }
    }
  },
  "desktop.open_app": {
    type: "object",
    additionalProperties: false,
    required: ["appName"],
    properties: {
      appName: STRING
    }
  },
  "browser.open_url": {
    type: "object",
    additionalProperties: false,
    required: ["url"],
    properties: {
      url: {
        type: "string",
        description: "HTTP or HTTPS URL."
      }
    }
  },
  "mac.applescript": {
    type: "object",
    additionalProperties: false,
    required: ["script"],
    properties: {
      script: STRING
    }
  },
  "fs.read": {
    type: "object",
    additionalProperties: false,
    required: ["path"],
    properties: {
      path: STRING,
      encoding: STRING
    }
  },
  "fs.write": {
    type: "object",
    additionalProperties: false,
    required: ["path", "content"],
    properties: {
      path: STRING,
      content: STRING,
      encoding: STRING
    }
  },
  "fs.list": {
    type: "object",
    additionalProperties: false,
    required: ["path"],
    properties: {
      path: STRING,
      includeHidden: { type: "boolean" }
    }
  },
  "fs.stat": {
    type: "object",
    additionalProperties: false,
    required: ["path"],
    properties: {
      path: STRING
    }
  },
  "fs.append": {
    type: "object",
    additionalProperties: false,
    required: ["path", "content"],
    properties: {
      path: STRING,
      content: STRING,
      encoding: STRING
    }
  },
  "fs.mkdir": {
    type: "object",
    additionalProperties: false,
    required: ["path"],
    properties: {
      path: STRING,
      recursive: { type: "boolean" }
    }
  },
  "os.frontmost_app": {
    type: "object",
    additionalProperties: false,
    properties: {
      includeBundleId: { type: "boolean" }
    }
  },
  "os.screenshot": {
    type: "object",
    additionalProperties: false,
    properties: {
      path: STRING,
      format: {
        type: "string",
        enum: ["png", "jpg"]
      }
    }
  },
  "process.run": {
    type: "object",
    additionalProperties: false,
    required: ["command", "argv"],
    properties: {
      command: STRING,
      argv: {
        type: "array",
        items: STRING
      },
      cwd: STRING,
      env: {
        type: "object",
        additionalProperties: { type: "string" }
      }
    }
  },
  "process.run_background": {
    type: "object",
    additionalProperties: false,
    required: ["command", "argv"],
    properties: {
      command: STRING,
      argv: {
        type: "array",
        items: STRING
      },
      cwd: STRING,
      env: {
        type: "object",
        additionalProperties: { type: "string" }
      }
    }
  },
  "process.list": {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: {
        type: "number",
        minimum: 1
      }
    }
  },
  "process.kill": {
    type: "object",
    additionalProperties: false,
    required: ["pid"],
    properties: {
      pid: {
        type: "number",
        minimum: 1
      },
      signal: STRING
    }
  }
};

export function exportPlannerTools(capabilities: CapabilityRegistry): PlannerToolDefinition[] {
  return capabilities.list().map((capability) => ({
    name: capability.id,
    description: capability.description,
    inputSchema: CAPABILITY_INPUT_SCHEMAS[capability.id],
    supportedProfiles: capability.supportedProfiles,
    defaultProfile: capability.defaultProfile
  }));
}
