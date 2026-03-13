import path from "node:path";
import { JsonFileStore } from "../storage/json-file-store.ts";
import type { AuditEntry } from "./types.ts";

interface AuditState {
  items: AuditEntry[];
}

function createId(): string {
  return `aud_${Math.random().toString(36).slice(2, 10)}`;
}

export class AuditStore {
  private readonly store: JsonFileStore<AuditState>;

  constructor(dataDir: string) {
    this.store = new JsonFileStore<AuditState>(path.join(dataDir, "audit-log.json"), {
      items: []
    });
  }

  append(entry: Omit<AuditEntry, "id" | "createdAt">): AuditEntry {
    const next: AuditEntry = {
      ...entry,
      id: createId(),
      createdAt: new Date().toISOString()
    };
    this.store.update((state) => ({ items: [next, ...state.items] }));
    return next;
  }

  list(limit = 50): AuditEntry[] {
    return this.store.read().items.slice(0, limit);
  }
}
