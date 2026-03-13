import type { AuthProfileRecord } from "../auth/auth-profile-store.ts";
import type { PlannerEnvelope, PlannerProviderDescriptor, PlannerRuntimeRequest } from "./types.ts";
import type {
  NormalizedProviderId,
  PlannerRuntimeApiKind,
  PlannerRuntimeTarget,
  PlannerRuntimeWrapperParams,
  ProviderFamily
} from "./runtime-target.ts";

export type NativePlannerRuntimeApiKind = Extract<
  PlannerRuntimeApiKind,
  "openai-responses" | "openai-codex-responses"
>;

export interface NativePlannerRuntimeRequestContext {
  request: PlannerRuntimeRequest;
  target: PlannerRuntimeTarget;
  descriptor: PlannerProviderDescriptor;
  wrapper: PlannerRuntimeWrapperParams;
  authProfile?: AuthProfileRecord;
}

export interface NativePlannerPayloadNormalizer {
  readonly id: NativePlannerRuntimeApiKind;
  normalizeRequestPayload(context: NativePlannerRuntimeRequestContext): unknown;
  normalizePlannerEnvelope(rawOutput: unknown, context: NativePlannerRuntimeRequestContext): PlannerEnvelope;
}

export interface NativePlannerRuntimeContract {
  runtimeApiKind: NativePlannerRuntimeApiKind;
  providerId: Extract<NormalizedProviderId, "openai" | "openai-codex">;
  providerFamily: Extract<ProviderFamily, "openai">;
  implementationStatus: "placeholder";
  transport: "native-runtime";
  supportsToolCalling: true;
  supportsFastMode: boolean;
  wrapperDefaults: PlannerRuntimeWrapperParams;
  requestPayloadFormat: string;
  responsePayloadFormat: string;
  payloadNormalizerId: NativePlannerRuntimeApiKind;
  notes: string;
}

export const NATIVE_PLANNER_RUNTIME_CONTRACTS: Record<
  NativePlannerRuntimeApiKind,
  NativePlannerRuntimeContract
> = {
  "openai-responses": {
    runtimeApiKind: "openai-responses",
    providerId: "openai",
    providerFamily: "openai",
    implementationStatus: "placeholder",
    transport: "native-runtime",
    supportsToolCalling: true,
    supportsFastMode: true,
    wrapperDefaults: {
      transportMode: "native-runtime",
      fastMode: "off",
      payloadNormalizerId: "openai-responses"
    },
    requestPayloadFormat: "OpenAI Responses API tool-calling request payload",
    responsePayloadFormat: "OpenAI Responses API output normalized into planner-envelope.v1",
    payloadNormalizerId: "openai-responses",
    notes: "Placeholder contract only. LobsterMind does not ship a native OpenAI Responses runtime yet."
  },
  "openai-codex-responses": {
    runtimeApiKind: "openai-codex-responses",
    providerId: "openai-codex",
    providerFamily: "openai",
    implementationStatus: "placeholder",
    transport: "native-runtime",
    supportsToolCalling: true,
    supportsFastMode: true,
    wrapperDefaults: {
      transportMode: "native-runtime",
      fastMode: "off",
      payloadNormalizerId: "openai-codex-responses"
    },
    requestPayloadFormat: "OpenAI Codex Responses tool-calling request payload",
    responsePayloadFormat: "OpenAI Codex Responses output normalized into planner-envelope.v1",
    payloadNormalizerId: "openai-codex-responses",
    notes: "Placeholder contract only. LobsterMind does not ship a native OpenAI Codex Responses runtime yet."
  }
};

export function getNativePlannerRuntimeContract(
  runtimeApiKind: PlannerRuntimeApiKind
): NativePlannerRuntimeContract | undefined {
  if (runtimeApiKind === "openai-responses" || runtimeApiKind === "openai-codex-responses") {
    return NATIVE_PLANNER_RUNTIME_CONTRACTS[runtimeApiKind];
  }
  return undefined;
}
