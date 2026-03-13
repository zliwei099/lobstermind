import type { ApprovalMode } from "../config.ts";
import { classifyRisk, requiresApproval } from "./policy.ts";
import { ApprovalStore } from "./approval-store.ts";
import { LocalShellAdapter } from "./adapters/local-shell-adapter.ts";
import { MacOpenAppAdapter } from "./adapters/mac-open-app-adapter.ts";
import { MacOpenUrlAdapter } from "./adapters/mac-open-url-adapter.ts";
import { MacAppleScriptAdapter } from "./adapters/mac-applescript-adapter.ts";
import type { ApprovalRequest, ComputerAction, ExecutionResult } from "./types.ts";

export interface ExecutionDecision {
  state: "executed" | "pending_approval";
  result?: ExecutionResult;
  approval?: ApprovalRequest;
}

export class ComputerActionExecutor {
  approvalMode: ApprovalMode;
  approvals: ApprovalStore;
  shellAdapter: LocalShellAdapter;
  openAppAdapter: MacOpenAppAdapter;
  openUrlAdapter: MacOpenUrlAdapter;
  appleScriptAdapter: MacAppleScriptAdapter;

  constructor(
    approvalMode: ApprovalMode,
    approvals: ApprovalStore,
    shellAdapter: LocalShellAdapter,
    openAppAdapter: MacOpenAppAdapter,
    openUrlAdapter: MacOpenUrlAdapter,
    appleScriptAdapter: MacAppleScriptAdapter
  ) {
    this.approvalMode = approvalMode;
    this.approvals = approvals;
    this.shellAdapter = shellAdapter;
    this.openAppAdapter = openAppAdapter;
    this.openUrlAdapter = openUrlAdapter;
    this.appleScriptAdapter = appleScriptAdapter;
  }

  async submit(senderId: string, action: ComputerAction): Promise<ExecutionDecision> {
    const { risk, reason } = classifyRisk(action);

    if (requiresApproval(this.approvalMode, risk)) {
      const approval = this.approvals.create({
        senderId,
        action,
        risk,
        reason
      });
      return {
        state: "pending_approval",
        approval
      };
    }

    const result = await this.execute(action);
    return {
      state: "executed",
      result
    };
  }

  async approve(id: string): Promise<ExecutionResult | undefined> {
    const record = this.approvals.get(id);
    if (!record || record.status !== "pending") {
      return undefined;
    }
    this.approvals.updateStatus(id, "approved");
    const result = await this.execute(record.action);
    this.approvals.updateStatus(id, "executed");
    return result;
  }

  reject(id: string): ApprovalRequest | undefined {
    const record = this.approvals.get(id);
    if (!record || record.status !== "pending") {
      return undefined;
    }
    return this.approvals.updateStatus(id, "rejected");
  }

  execute(action: ComputerAction): Promise<ExecutionResult> {
    if (action.type === "shell.command") {
      return this.shellAdapter.execute(action);
    }
    if (action.type === "desktop.open_app") {
      return this.openAppAdapter.execute(action);
    }
    if (action.type === "browser.open_url") {
      return this.openUrlAdapter.execute(action);
    }
    return this.appleScriptAdapter.execute(action);
  }
}
