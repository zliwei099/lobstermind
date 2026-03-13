import fs from "node:fs";
import path from "node:path";

export class JsonFileStore<T> {
  filePath: string;
  defaultValue: T;

  constructor(filePath: string, defaultValue: T) {
    this.filePath = filePath;
    this.defaultValue = defaultValue;
  }

  read(): T {
    this.ensureParent();
    if (!fs.existsSync(this.filePath)) {
      return this.defaultValue;
    }
    const raw = fs.readFileSync(this.filePath, "utf8");
    return JSON.parse(raw) as T;
  }

  write(value: T): void {
    this.ensureParent();
    fs.writeFileSync(this.filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  update(mutator: (current: T) => T): T {
    const next = mutator(this.read());
    this.write(next);
    return next;
  }

  ensureParent(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
  }
}
