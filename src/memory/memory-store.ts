export interface MemoryEntry {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  tags: string[];
}

export interface MemoryStore {
  add(entry: Omit<MemoryEntry, "id" | "createdAt" | "tags"> & { tags?: string[] }): MemoryEntry;
  list(senderId?: string): MemoryEntry[];
  search(query: string, senderId?: string): MemoryEntry[];
}
