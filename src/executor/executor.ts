import type { AppConfig } from "../config.ts";
import { ApprovalStore } from "./approval-store.ts";
import { AuditStore } from "./audit-store.ts";
import { CapabilityRegistry } from "./capability-registry.ts";
import type {
  ApprovalRequest,
  CapabilityRequest,
  ExecutionDecision,
  ExecutionResult,
  PolicyEvaluation
} from "./types.ts";

export class ComputerActionExecutor {
  private readonly config: AppConfig;
  private readonly approvals: ApprovalStore;
  private readonly audits: AuditStore;
  private readonly capabilities: CapabilityRegistry;

  constructor(config: AppConfig, approvals: ApprovalStore, audits: AuditStore, capabilities: CapabilityRegistry) {
    this.config = config;
    this.approvals = approvals;
    this.audits = audits;
    this.capabilities = capabilities;
  }

  async submit(senderId: string, request: CapabilityRequest): Promise<ExecutionDecision> {
    const capability = this.capabilities.get(request.capability);
    if (!capability) {
      return {
        state: "denied",
        reason: `Unknown capability "${request.capability}".`
      };
    }

    const evaluation = capability.evaluatePolicy(request, { config: this.config });
    this.recordAudit("requested", senderId, request, evaluation);

    if (evaluation.status === "denied") {
      this.recordAudit("denied", senderId, request, evaluation);
      return {
        state: "denied",
        reason: evaluation.reason
      };
    }

    if (evaluation.status === "needs_approval") {
      const approval = this.approvals.create({
        senderId,
        request,
        capability: request.capability,
        profile: evaluation.profile,
        risk: evaluation.risk,
        reason: evaluation.reason
      });
      this.recordAudit("pending_approval", senderId, request, evaluation, undefined, approval.id);
      return {
        state: "pending_approval",
        approval
      };
    }

    const result = await capability.execute(request, { config: this.config });
    this.recordAudit("executed", senderId, request, evaluation, result);
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
    const evaluation: PolicyEvaluation = {
      status: "allowed",
      profile: record.profile,
      risk: record.risk,
      reason: record.reason
    };
    this.recordAudit("approved", record.senderId, record.request, evaluation, undefined, record.id);

    const capability = this.capabilities.get(record.capability);
    if (!capability) {
      const result = {
        ok: false,
        output: `Capability "${record.capability}" is no longer registered.`
      };
      this.recordAudit("executed", record.senderId, record.request, evaluation, result, record.id);
      this.approvals.updateStatus(id, "executed");
      return result;
    }

    const result = await capability.execute(record.request, { config: this.config });
    this.approvals.updateStatus(id, "executed");
    this.recordAudit("executed", record.senderId, record.request, evaluation, result, record.id);
    return result;
  }

  reject(id: string): ApprovalRequest | undefined {
    const record = this.approvals.get(id);
    if (!record || record.status !== "pending") {
      return undefined;
    }
    const rejected = this.approvals.updateStatus(id, "rejected");
    if (rejected) {
      this.recordAudit(
        "rejected",
        rejected.senderId,
        rejected.request,
        {
          status: "denied",
          profile: rejected.profile,
          risk: rejected.risk,
          reason: rejected.reason
        },
        undefined,
        rejected.id
      );
    }
    return rejected;
  }

  private recordAudit(
    event: "requested" | "pending_approval" | "approved" | "rejected" | "denied" | "executed",
    senderId: string,
    request: CapabilityRequest,
    evaluation: PolicyEvaluation,
    result?: ExecutionResult,
    approvalId?: string
  ): void {
    this.audits.append({
      event,
      senderId,
      capability: request.capability,
      profile: evaluation.profile,
      risk: evaluation.risk,
      reason: evaluation.reason,
      request,
      approvalId,
      result: result
        ? {
            ok: result.ok,
            output: result.output
          }
        : undefined
    });
  }
}
