import fs from "node:fs";
import path from "node:path";
import type { ExecutionResult, FsAppendInput, FsListInput, FsMkdirInput, FsReadInput, FsStatInput, FsWriteInput } from "../types.ts";

export class LocalFsAdapter {
  read(input: FsReadInput): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      try {
        const content = fs.readFileSync(input.path, input.encoding ?? "utf8");
        resolve({
          ok: true,
          output: `Read ${path.resolve(input.path)}.`,
          data: content
        });
      } catch (error) {
        resolve({
          ok: false,
          output: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  write(input: FsWriteInput): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      try {
        fs.mkdirSync(path.dirname(input.path), { recursive: true });
        fs.writeFileSync(input.path, input.content, input.encoding ?? "utf8");
        resolve({
          ok: true,
          output: `Wrote ${path.resolve(input.path)}.`
        });
      } catch (error) {
        resolve({
          ok: false,
          output: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  list(input: FsListInput): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      try {
        const entries = fs
          .readdirSync(input.path, { withFileTypes: true })
          .filter((entry) => input.includeHidden || !entry.name.startsWith("."))
          .map((entry) => ({
            name: entry.name,
            type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other"
          }));
        resolve({
          ok: true,
          output: `Listed ${path.resolve(input.path)}.`,
          data: entries
        });
      } catch (error) {
        resolve({
          ok: false,
          output: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  stat(input: FsStatInput): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      try {
        const stats = fs.statSync(input.path);
        resolve({
          ok: true,
          output: `Stat ${path.resolve(input.path)}.`,
          data: {
            path: path.resolve(input.path),
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            size: stats.size,
            mtime: stats.mtime.toISOString(),
            ctime: stats.ctime.toISOString()
          }
        });
      } catch (error) {
        resolve({
          ok: false,
          output: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  append(input: FsAppendInput): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      try {
        fs.mkdirSync(path.dirname(input.path), { recursive: true });
        fs.appendFileSync(input.path, input.content, input.encoding ?? "utf8");
        resolve({
          ok: true,
          output: `Appended ${path.resolve(input.path)}.`
        });
      } catch (error) {
        resolve({
          ok: false,
          output: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  mkdir(input: FsMkdirInput): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      try {
        fs.mkdirSync(input.path, { recursive: input.recursive ?? true });
        resolve({
          ok: true,
          output: `Created directory ${path.resolve(input.path)}.`
        });
      } catch (error) {
        resolve({
          ok: false,
          output: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }
}
