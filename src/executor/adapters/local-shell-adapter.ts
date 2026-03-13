import { spawn } from "node:child_process";
import process from "node:process";
import type { ExecutionResult, ShellExecInput } from "../types.ts";

export class LocalShellAdapter {
  private readonly allowlist: string[];
  private readonly timeoutMs: number;

  constructor(allowlist: string[], timeoutMs: number) {
    this.allowlist = allowlist;
    this.timeoutMs = timeoutMs;
  }

  execute(input: ShellExecInput): Promise<ExecutionResult> {
    if (!this.allowlist.includes(input.command)) {
      return Promise.resolve({
        ok: false,
        output: `Command "${input.command}" is not in the allowlist.`
      });
    }

    return new Promise((resolve) => {
      const child = spawn(input.command, input.argv, {
        cwd: input.cwd,
        env: input.env ? { ...process.env, ...input.env } : process.env,
        stdio: ["ignore", "pipe", "pipe"]
      });
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
      }, this.timeoutMs);

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });

      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("close", (code) => {
        clearTimeout(timeout);
        resolve({
          ok: code === 0,
          output: (stdout || stderr || `Exited with code ${code ?? "unknown"}`).trim()
        });
      });

      child.on("error", (error) => {
        clearTimeout(timeout);
        resolve({
          ok: false,
          output: error.message
        });
      });
    });
  }
}
