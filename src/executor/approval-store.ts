import path from "node:path";
import { JsonFileStore } from "../storage/json-file-store.ts";
import type {
  ApprovalRequest,
  ApprovalStatus,
  CapabilityRequest,
  ExecutionProfile,
  RiskLevel
} from "./types.ts";

interface ApprovalState {
  items: ApprovalRequest[];
}

interface LegacyApprovalRecord {
  id: string;
  senderId: string;
  createdAt: string;
  action?: {
    type: string;
    [key: string]: unknown;
  };
  risk: RiskLevel;
  status: ApprovalStatus;
  reason: string;
  resolvedAt?: string;
}

function createId(): string {
  return `apr_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeLegacyRequest(record: LegacyApprovalRecord): CapabilityRequest | undefined {
  const action = record.action;
  if (!action) {
    return undefined;
  }

  if (action.type === "shell.command" && typeof action.command === "string" && Array.isArray(action.args)) {
    return {
      capability: "shell.exec",
      input: {
        command: action.command,
        argv: action.args.filter((value): value is string => typeof value === "string")
      },
      requestedProfile: "workspace-write"
    };
  }

  if (action.type === "desktop.open_app" && typeof action.appName === "string") {
    return {
      capability: "desktop.open_app",
      input: { appName: action.appName },
      requestedProfile: "desktop-safe"
    };
  }

  if (action.type === "browser.open_url" && typeof action.url === "string") {
    return {
      capability: "browser.open_url",
      input: { url: action.url },
      requestedProfile: "desktop-safe"
    };
  }

  if (action.type === "mac.applescript" && typeof action.script === "string") {
    return {
      capability: "mac.applescript",
      input: { script: action.script },
      requestedProfile: "dangerous"
    };
  }

  return undefined;
}

function normalizeProfile(request: CapabilityRequest): ExecutionProfile {
  return request.requestedProfile ?? "workspace-write";
}

export class ApprovalStore {
  private readonly store: JsonFileStore<ApprovalState>;

  constructor(dataDir: string) {
    this.store = new JsonFileStore<ApprovalState>(path.join(dataDir, "approvals.json"), {
      items: []
    });
  }

  private readState(): ApprovalState {
    const raw = this.store.read() as ApprovalState & { items?: Array<ApprovalRequest | LegacyApprovalRecord> };
    return {
      items: (raw.items ?? [])
        .map((item) => {
          if ("request" in item && "capability" in item && "profile" in item) {
            return item as ApprovalRequest;
          }
          const legacy = item as LegacyApprovalRecord;
          const request = normalizeLegacyRequest(legacy);
          if (!request) {
            return undefined;
          }
          return {
            id: legacy.id,
            senderId: legacy.senderId,
            createdAt: legacy.createdAt,
            request,
            capability: request.capability,
            profile: normalizeProfile(request),
            risk: legacy.risk,
            status: legacy.status,
            reason: legacy.reason,
            resolvedAt: legacy.resolvedAt
          } satisfies ApprovalRequest;
        })
        .filter((item): item is ApprovalRequest => Boolean(item))
    };
  }

  create(request: Omit<ApprovalRequest, "id" | "createdAt" | "status">): ApprovalRequest {
    const next: ApprovalRequest = {
      ...request,
      id: createId(),
      createdAt: new Date().toISOString(),
      status: "pending"
    };
    const state = this.readState();
    this.store.write({ items: [next, ...state.items] });
    return next;
  }

  list(status?: ApprovalStatus): ApprovalRequest[] {
    return this.readState().items.filter((item) => !status || item.status === status);
  }

  get(id: string): ApprovalRequest | undefined {
    return this.readState().items.find((item) => item.id === id);
  }

  updateStatus(id: string, status: ApprovalStatus): ApprovalRequest | undefined {
    let updated: ApprovalRequest | undefined;
    const state = this.readState();
    this.store.write({
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
    });
    return updated;
  }
}
