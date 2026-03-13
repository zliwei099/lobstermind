import { spawn } from "node:child_process";
import type { ExecutionResult, OpenAppAction } from "../types.ts";

export class MacOpenAppAdapter {
  execute(action: OpenAppAction): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const child = spawn("open", ["-a", action.appName], {
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stderr = "";

      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("close", (code) => {
        resolve({
          ok: code === 0,
          output: code === 0 ? `Opened app "${action.appName}".` : stderr.trim() || `Exited with code ${code ?? "unknown"}`
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
