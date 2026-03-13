import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { Provider } from "./types.ts";

export interface CodexProviderOptions {
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
  required: ["action"],
  properties: {
    action: {
      type: "string",
      enum: ["request", "clarification"]
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
    }
  },
  allOf: [
    {
      if: { properties: { action: { const: "request" } } },
      then: { required: ["request"] }
    },
    {
      if: { properties: { action: { const: "clarification" } } },
      then: { required: ["clarification"] }
    }
  ]
};

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

export class CodexProvider implements Provider {
  private readonly command: string;
  private readonly model: string;
  private readonly workspaceRoot: string;

  constructor(options: CodexProviderOptions) {
    this.command = options.command;
    this.model = options.model;
    this.workspaceRoot = options.workspaceRoot;
  }

  async complete(prompt: string): Promise<string> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lobstermind-codex-"));
    const schemaPath = path.join(tempDir, "brain-schema.json");
    const outputPath = path.join(tempDir, "brain-output.json");
    fs.writeFileSync(schemaPath, JSON.stringify(OUTPUT_SCHEMA, null, 2), "utf8");

    try {
      await this.runCodex(prompt, schemaPath, outputPath);
      if (!fs.existsSync(outputPath)) {
        throw new CodexProviderError("Codex returned without a final planner message.");
      }
      const output = fs.readFileSync(outputPath, "utf8").trim();
      if (!output) {
        throw new CodexProviderError("Codex returned an empty planner response.");
      }
      return output;
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
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
