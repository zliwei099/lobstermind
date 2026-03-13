import { spawn } from "node:child_process";
import type { AppleScriptAction, ExecutionResult } from "../types.ts";

export class MacAppleScriptAdapter {
  execute(action: AppleScriptAction): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const child = spawn("osascript", ["-e", action.script], {
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });

      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("close", (code) => {
        resolve({
          ok: code === 0,
          output: (stdout || stderr || `Exited with code ${code ?? "unknown"}`).trim()
        });
      });

      child.on("error", (error) => {
        resolve({
          ok: false,
          output: error.message
        });
      });
    });
  }
}
