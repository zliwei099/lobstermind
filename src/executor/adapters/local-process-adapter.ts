import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import type { ExecutionResult, ProcessKillInput, ProcessListInput, ProcessRunInput } from "../types.ts";

interface BackgroundRecord {
  pid: number;
  command: string;
  argv: string[];
  cwd?: string;
  startedAt: string;
  logPath: string;
}

export class LocalProcessAdapter {
  private readonly dataDir: string;
  private readonly timeoutMs: number;
  private readonly backgroundIndexPath: string;

  constructor(dataDir: string, timeoutMs: number) {
    this.dataDir = dataDir;
    this.timeoutMs = timeoutMs;
    this.backgroundIndexPath = path.join(this.dataDir, "processes", "background-processes.json");
  }

  run(input: ProcessRunInput): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      let child;
      try {
        child = spawn(input.command, input.argv, {
          cwd: input.cwd,
          env: input.env ? { ...process.env, ...input.env } : process.env,
          stdio: ["ignore", "pipe", "pipe"]
        });
      } catch (error) {
        resolve({
          ok: false,
          output: error instanceof Error ? error.message : String(error)
        });
        return;
      }

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

  runBackground(input: ProcessRunInput): Promise<ExecutionResult> {
    fs.mkdirSync(path.join(this.dataDir, "processes"), { recursive: true });

    return new Promise((resolve) => {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const baseName = `${path.basename(input.command)}-${stamp}`;
      const logPath = path.join(this.dataDir, "processes", `${baseName}.log`);
      let logFd = -1;
      let child;
      try {
        logFd = fs.openSync(logPath, "a");
        child = spawn(input.command, input.argv, {
          cwd: input.cwd,
          env: input.env ? { ...process.env, ...input.env } : process.env,
          detached: true,
          stdio: ["ignore", logFd, logFd]
        });
      } catch (error) {
        if (logFd !== -1) {
          fs.closeSync(logFd);
        }
        resolve({
          ok: false,
          output: error instanceof Error ? error.message : String(error)
        });
        return;
      }

      child.on("spawn", () => {
        fs.closeSync(logFd);
        child.unref();
        const record: BackgroundRecord = {
          pid: child.pid ?? -1,
          command: input.command,
          argv: input.argv,
          cwd: input.cwd,
          startedAt: new Date().toISOString(),
          logPath
        };
        this.saveBackgroundRecord(record);
        resolve({
          ok: true,
          output: `Started background process ${record.pid}.`,
          data: record
        });
      });

      child.on("error", (error) => {
        try {
          fs.closeSync(logFd);
        } catch {
          // Ignore close errors after spawn failures.
        }
        resolve({
          ok: false,
          output: error.message
        });
      });
    });
  }

  list(input: ProcessListInput): Promise<ExecutionResult> {
    const limit = Math.max(1, Math.min(input.limit ?? 25, 200));

    return new Promise((resolve) => {
      let child;
      try {
        child = spawn("ps", ["-axo", "pid=,ppid=,state=,comm=,args="], {
          stdio: ["ignore", "pipe", "pipe"]
        });
      } catch (error) {
        resolve({
          ok: false,
          output: error instanceof Error ? error.message : String(error)
        });
        return;
      }

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });

      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("close", (code) => {
        if (code !== 0) {
          resolve({
            ok: false,
            output: (stderr || `ps exited with code ${code ?? "unknown"}`).trim()
          });
          return;
        }

        const tracked = new Set(this.loadBackgroundRecords().map((record) => record.pid));
        const rows = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, limit)
          .map((line) => {
            const match = line.match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.*)$/);
            if (!match) {
              return undefined;
            }
            return {
              pid: Number(match[1]),
              ppid: Number(match[2]),
              state: match[3],
              command: match[4],
              args: match[5],
              tracked: tracked.has(Number(match[1]))
            };
          })
          .filter((row): row is NonNullable<typeof row> => Boolean(row));

        resolve({
          ok: true,
          output: `Listed ${rows.length} processes.`,
          data: rows
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

  kill(input: ProcessKillInput): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      try {
        process.kill(input.pid, input.signal ?? "SIGTERM");
        resolve({
          ok: true,
          output: `Sent ${input.signal ?? "SIGTERM"} to process ${input.pid}.`
        });
      } catch (error) {
        resolve({
          ok: false,
          output: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  private loadBackgroundRecords(): BackgroundRecord[] {
    try {
      return JSON.parse(fs.readFileSync(this.backgroundIndexPath, "utf8")) as BackgroundRecord[];
    } catch {
      return [];
    }
  }

  private saveBackgroundRecord(record: BackgroundRecord): void {
    const records = this.loadBackgroundRecords();
    records.unshift(record);
    fs.mkdirSync(path.dirname(this.backgroundIndexPath), { recursive: true });
    fs.writeFileSync(this.backgroundIndexPath, JSON.stringify(records.slice(0, 200), null, 2), "utf8");
  }
}
