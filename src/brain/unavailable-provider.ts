import type { AuthProfileRecord } from "../auth/auth-profile-store.ts";
import type { PlannerEnvelope, PlannerProvider, PlannerRuntimeRequest } from "./types.ts";
import type { PlannerRuntimeTarget } from "./runtime-target.ts";

export interface UnavailablePlannerProviderOptions {
  target: PlannerRuntimeTarget;
  authProfile?: AuthProfileRecord;
}

export class UnavailablePlannerProvider implements PlannerProvider {
  readonly descriptor;

  private readonly target: PlannerRuntimeTarget;
  private readonly authProfile?: AuthProfileRecord;

  constructor(options: UnavailablePlannerProviderOptions) {
    this.target = options.target;
    this.authProfile = options.authProfile;
    this.descriptor = {
      id: options.target.runtimeApiKind,
      label: `Unavailable planner runtime (${options.target.runtimeApiKind})`,
      transport: "native-runtime",
      experimental: false,
      supportsToolCalling: false,
      providerId: options.target.providerId,
      modelRef: options.target.modelRef,
      runtimeApiKind: options.target.runtimeApiKind
    } as const;
  }

  async plan(request: PlannerRuntimeRequest): Promise<PlannerEnvelope> {
    const authDetail = this.authProfile
      ? ` Default auth profile: ${this.authProfile.id} (${this.authProfile.mode}).`
      : "";
    return {
      version: "planner-envelope.v1",
      provider: this.descriptor,
      traceId: request.context.traceId,
      decision: {
        kind: "unsupported",
        unsupported: {
          text: `Planner runtime "${this.target.runtimeApiKind}" is not implemented in this repository yet.`,
          reason: "planner_runtime_not_implemented"
        }
      },
      diagnostics: [
        {
          level: "warning",
          code: "planner_runtime_not_implemented",
          message:
            `Configured target ${this.target.modelRef} via ${this.target.runtimeApiKind}, but only the mock runtime and the experimental Codex CLI bridge are implemented today.` +
            authDetail
        }
      ]
    };
  }
}
