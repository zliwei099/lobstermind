import type { AppConfig } from "../config.ts";
import type {
  CapabilityId,
  CapabilityRequest,
  ExecutionProfile,
  ExecutionResult,
  PolicyEvaluation
} from "./types.ts";

export interface CapabilityContext {
  config: AppConfig;
}

export interface CapabilityDefinition<TRequest extends CapabilityRequest = CapabilityRequest> {
  id: TRequest["capability"];
  description: string;
  supportedProfiles: ExecutionProfile[];
  defaultProfile: ExecutionProfile;
  summarize(request: TRequest): string;
  evaluatePolicy(request: TRequest, context: CapabilityContext): PolicyEvaluation;
  execute(request: TRequest, context: CapabilityContext): Promise<ExecutionResult>;
}

export class CapabilityRegistry {
  private readonly capabilities = new Map<CapabilityId, CapabilityDefinition>();

  register<TRequest extends CapabilityRequest>(definition: CapabilityDefinition<TRequest>): void {
    this.capabilities.set(definition.id, definition as CapabilityDefinition);
  }

  get<TRequest extends CapabilityRequest>(capability: TRequest["capability"]): CapabilityDefinition<TRequest> | undefined {
    return this.capabilities.get(capability) as CapabilityDefinition<TRequest> | undefined;
  }

  list(): CapabilityDefinition[] {
    return Array.from(this.capabilities.values()).sort((a, b) => a.id.localeCompare(b.id));
  }
}
