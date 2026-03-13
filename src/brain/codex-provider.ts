import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { normalizePlannerEnvelope } from "./planning-envelope.ts";
import type { PlannerEnvelope, PlannerProvider, PlannerRuntimeRequest } from "./types.ts";

export interface CodexCliBridgeProviderOptions {
  command: string;
  model: string;
  workspaceRoot: string;
}

export class CodexProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexProviderError";
  }
}

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["version", "traceId", "decision"],
  properties: {
    version: {
      type: "string",
      const: "planner-envelope.v1"
    },
    traceId: {
      type: "string"
    },
    diagnostics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["level", "code", "message"],
        properties: {
          level: {
            type: "string",
            enum: ["info", "warning", "error"]
          },
          code: { type: "string" },
          message: { type: "string" }
        }
      }
    },
    decision: {
      type: "object",
      additionalProperties: false,
      required: ["kind"],
      properties: {
        kind: {
          type: "string",
          enum: ["request", "clarification", "refusal", "unsupported"]
        },
        request: {
          type: "object",
          additionalProperties: true,
          required: ["capability", "input"],
          properties: {
            capability: { type: "string" },
            input: { type: "object" },
            requestedProfile: { type: "string" },
            metadata: {
              type: "object",
              additionalProperties: true,
              properties: {
                sourceCommand: { type: "string" },
                note: { type: "string" }
              }
            }
          }
        },
        clarification: {
          type: "object",
          additionalProperties: false,
          required: ["text"],
          properties: {
            text: { type: "string" }
          }
        },
        refusal: {
          type: "object",
          additionalProperties: false,
          required: ["text"],
          properties: {
            text: { type: "string" },
            reason: { type: "string" }
          }
        },
        unsupported: {
          type: "object",
          additionalProperties: false,
          required: ["text"],
          properties: {
            text: { type: "string" },
            reason: { type: "string" }
          }
        }
      },
      allOf: [
        {
          if: { properties: { kind: { const: "request" } } },
          then: { required: ["request"] }
        },
        {
          if: { properties: { kind: { const: "clarification" } } },
          then: { required: ["clarification"] }
        },
        {
          if: { properties: { kind: { const: "refusal" } } },
          then: { required: ["refusal"] }
        },
        {
          if: { properties: { kind: { const: "unsupported" } } },
          then: { required: ["unsupported"] }
        }
      ]
    }
  }
};

function sanitizeJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return trimmed;
}

function summarizeCodexFailure(stderr: string, exitCode: number | null): string {
  const lines = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const preferredLine =
    lines.find((line) => /^ERROR:/i.test(line)) ??
    lines.find((line) => /failed to connect|stream disconnected|error sending request/i.test(line)) ??
    lines.at(-1);

  return preferredLine || `exit code ${exitCode ?? "unknown"}`;
}

export class CodexCliBridgeProvider implements PlannerProvider {
  readonly descriptor = {
    id: "codex-cli",
    label: "Codex CLI bridge",
    transport: "cli-bridge",
    experimental: true,
    supportsToolCalling: false
  } as const;

  private readonly command: string;
  private readonly model: string;
  private readonly workspaceRoot: string;

  constructor(options: CodexCliBridgeProviderOptions) {
    this.command = options.command;
    this.model = options.model;
    this.workspaceRoot = options.workspaceRoot;
  }

  async plan(request: PlannerRuntimeRequest): Promise<PlannerEnvelope> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lobstermind-codex-"));
    const schemaPath = path.join(tempDir, "planner-schema.json");
    const outputPath = path.join(tempDir, "planner-output.json");
    fs.writeFileSync(schemaPath, JSON.stringify(OUTPUT_SCHEMA, null, 2), "utf8");

    try {
      await this.runCodex(this.buildPrompt(request), schemaPath, outputPath);
      if (!fs.existsSync(outputPath)) {
        throw new CodexProviderError("Codex returned without a final planner message.");
      }
      const output = fs.readFileSync(outputPath, "utf8").trim();
      if (!output) {
        throw new CodexProviderError("Codex returned an empty planner response.");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(sanitizeJson(output));
      } catch (error) {
        throw new CodexProviderError(
          `Codex returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      return normalizePlannerEnvelope(parsed, this.descriptor, request);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private buildPrompt(request: PlannerRuntimeRequest): string {
    return [
      "You are LobsterMind's planning runtime bridge.",
      "You are not the executor. You only choose one registered capability request, ask for clarification, refuse, or mark the request unsupported.",
      "All execution happens later in LobsterMind's policy, approval, and audit controlled executor.",
      "Return a planner-envelope.v1 JSON object only and follow the provided schema exactly.",
      "Use only the listed tool names.",
      `Copy this traceId exactly into the response: ${request.context.traceId}`,
      "If a required argument is missing, return kind=clarification.",
      "If the user is asking for something LobsterMind should not do, return kind=refusal.",
      "If the request cannot be represented by the available tools, return kind=unsupported.",
      "Prefer the tool's default profile unless the intent clearly requires a different supported profile.",
      "",
      `User intent: ${request.intent}`,
      "",
      `Available tools: ${JSON.stringify(request.toolCatalog, null, 2)}`,
      "",
      "Examples:",
      JSON.stringify({
        version: "planner-envelope.v1",
        traceId: request.context.traceId,
        diagnostics: [],
        decision: {
          kind: "request",
          request: {
            capability: "fs.read",
            input: { path: "README.md" },
            requestedProfile: "readonly",
            metadata: {
              sourceCommand: "planner-runtime",
              note: "Read the requested file"
            }
          }
        }
      }),
      JSON.stringify({
        version: "planner-envelope.v1",
        traceId: request.context.traceId,
        diagnostics: [],
        decision: {
          kind: "clarification",
          clarification: {
            text: "Which file should I read?"
          }
        }
      }),
      JSON.stringify({
        version: "planner-envelope.v1",
        traceId: request.context.traceId,
        diagnostics: [],
        decision: {
          kind: "unsupported",
          unsupported: {
            text: "I can only plan actions that map to the registered capability tools.",
            reason: "no_matching_tool"
          }
        }
      })
    ].join("\n");
  }

  private runCodex(prompt: string, schemaPath: string, outputPath: string): Promise<void> {
    const args = [
      "exec",
      "--model",
      this.model,
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "--color",
      "never",
      "--output-schema",
      schemaPath,
      "--output-last-message",
      outputPath,
      "-"
    ];

    return new Promise((resolve, reject) => {
      const child = spawn(this.command, args, {
        cwd: this.workspaceRoot,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"]
      });

      let stderr = "";

      child.on("error", (error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          reject(new CodexProviderError(`Codex CLI was not found at "${this.command}".`));
          return;
        }
        reject(new CodexProviderError(`Failed to start Codex CLI: ${error.message}`));
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new CodexProviderError(`Codex planning failed: ${summarizeCodexFailure(stderr, code)}`));
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }
}

export { CodexCliBridgeProvider as CodexProvider };
