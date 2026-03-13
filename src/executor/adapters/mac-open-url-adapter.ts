import { spawn } from "node:child_process";
import type { ExecutionResult, OpenUrlInput } from "../types.ts";

export class MacOpenUrlAdapter {
  execute(input: OpenUrlInput): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const child = spawn("open", [input.url], {
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stderr = "";

      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("close", (code) => {
        resolve({
          ok: code === 0,
          output: code === 0 ? `Opened URL "${input.url}".` : stderr.trim() || `Exited with code ${code ?? "unknown"}`
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
