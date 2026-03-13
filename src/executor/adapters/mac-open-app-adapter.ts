import { spawn } from "node:child_process";
import type { ExecutionResult, OpenAppInput } from "../types.ts";

export class MacOpenAppAdapter {
  execute(input: OpenAppInput): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const child = spawn("open", ["-a", input.appName], {
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stderr = "";

      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("close", (code) => {
        resolve({
          ok: code === 0,
          output: code === 0 ? `Opened app "${input.appName}".` : stderr.trim() || `Exited with code ${code ?? "unknown"}`
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
