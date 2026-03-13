import { spawn } from "node:child_process";
import type { ExecutionResult, FrontmostAppInput } from "../types.ts";

export class MacFrontmostAppAdapter {
  execute(input: FrontmostAppInput): Promise<ExecutionResult> {
    const script = input.includeBundleId
      ? 'tell application "System Events" to get {name, bundle identifier} of first application process whose frontmost is true'
      : 'tell application "System Events" to get name of first application process whose frontmost is true';

    return new Promise((resolve) => {
      const child = spawn("osascript", ["-e", script], {
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
          output: (stdout || stderr || `Exited with code ${code ?? "unknown"}`).trim(),
          data: stdout.trim() || undefined
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
