import fs from "node:fs";
import path from "node:path";
import type { ExecutionResult, FsReadInput, FsWriteInput } from "../types.ts";

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
}
