import path from "node:path";
import { JsonFileStore } from "../storage/json-file-store.ts";
import type { MemoryEntry, MemoryStore } from "./memory-store.ts";

interface MemoryState {
  entries: MemoryEntry[];
}

function createId(): string {
  return `mem_${Math.random().toString(36).slice(2, 10)}`;
}

export class FileMemoryStore implements MemoryStore {
  store: JsonFileStore<MemoryState>;

  constructor(dataDir: string) {
    this.store = new JsonFileStore<MemoryState>(path.join(dataDir, "memory.json"), {
      entries: []
    });
  }

  add(entry: Omit<MemoryEntry, "id" | "createdAt" | "tags"> & { tags?: string[] }): MemoryEntry {
    const next: MemoryEntry = {
      id: createId(),
      senderId: entry.senderId,
      text: entry.text,
      createdAt: new Date().toISOString(),
      tags: entry.tags ?? []
    };
    this.store.update((state) => ({
      entries: [next, ...state.entries]
    }));
    return next;
  }

  list(senderId?: string): MemoryEntry[] {
    return this.store.read().entries.filter((entry) => !senderId || entry.senderId === senderId);
  }

  search(query: string, senderId?: string): MemoryEntry[] {
    const normalized = query.toLowerCase();
    return this.list(senderId).filter((entry) => entry.text.toLowerCase().includes(normalized));
  }
}
