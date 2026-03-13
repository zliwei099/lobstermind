import { spawn } from "node:child_process";
import type { ShellCommandAction, ExecutionResult } from "../types.ts";

export class LocalShellAdapter {
  allowlist: string[];
  timeoutMs: number;

  constructor(allowlist: string[], timeoutMs: number) {
    this.allowlist = allowlist;
    this.timeoutMs = timeoutMs;
  }

  execute(action: ShellCommandAction): Promise<ExecutionResult> {
    if (!this.allowlist.includes(action.command)) {
      return Promise.resolve({
        ok: false,
        output: `Command "${action.command}" is not in the allowlist.`
      });
    }

    return new Promise((resolve) => {
      const child = spawn(action.command, action.args, {
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
