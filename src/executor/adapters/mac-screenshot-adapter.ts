import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { ExecutionResult, ScreenshotInput } from "../types.ts";

export class MacScreenshotAdapter {
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  execute(input: ScreenshotInput): Promise<ExecutionResult> {
    const format = input.format ?? "png";
    const targetPath = this.resolveTargetPath(input.path, format);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    return new Promise((resolve) => {
      let child;
      try {
        child = spawn("screencapture", ["-x", targetPath], {
          stdio: ["ignore", "pipe", "pipe"]
        });
      } catch (error) {
        resolve({
          ok: false,
          output: error instanceof Error ? error.message : String(error)
        });
        return;
      }

      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({
            ok: true,
            output: `Saved screenshot to ${targetPath}.`,
            data: {
              path: targetPath,
              format
            }
          });
          return;
        }

        resolve({
          ok: false,
          output: (stderr || `screencapture exited with code ${code ?? "unknown"}`).trim()
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

  private resolveTargetPath(requestedPath: string | undefined, format: "png" | "jpg"): string {
    const suffix = format === "jpg" ? ".jpg" : ".png";
    if (requestedPath) {
      const resolved = path.resolve(requestedPath);
      return path.extname(resolved) ? resolved : `${resolved}${suffix}`;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return path.join(this.dataDir, "screenshots", `screenshot-${stamp}${suffix}`);
  }
}
