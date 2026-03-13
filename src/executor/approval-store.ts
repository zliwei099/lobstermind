import path from "node:path";
import { JsonFileStore } from "../storage/json-file-store.ts";
import type { ApprovalRequest, ApprovalStatus } from "./types.ts";

interface ApprovalState {
  items: ApprovalRequest[];
}

function createId(): string {
  return `apr_${Math.random().toString(36).slice(2, 10)}`;
}

export class ApprovalStore {
  store: JsonFileStore<ApprovalState>;

  constructor(dataDir: string) {
    this.store = new JsonFileStore<ApprovalState>(path.join(dataDir, "approvals.json"), {
      items: []
    });
  }

  create(request: Omit<ApprovalRequest, "id" | "createdAt" | "status">): ApprovalRequest {
    const next: ApprovalRequest = {
      ...request,
      id: createId(),
      createdAt: new Date().toISOString(),
      status: "pending"
    };
    this.store.update((state) => ({ items: [next, ...state.items] }));
    return next;
  }

  list(status?: ApprovalStatus): ApprovalRequest[] {
    return this.store.read().items.filter((item) => !status || item.status === status);
  }

  get(id: string): ApprovalRequest | undefined {
    return this.store.read().items.find((item) => item.id === id);
  }

  updateStatus(id: string, status: ApprovalStatus): ApprovalRequest | undefined {
    let updated: ApprovalRequest | undefined;
    this.store.update((state) => ({
      items: state.items.map((item) => {
        if (item.id !== id) {
          return item;
        }
        updated = {
          ...item,
          status,
          resolvedAt: new Date().toISOString()
        };
        return updated;
      })
    }));
    return updated;
  }
}
