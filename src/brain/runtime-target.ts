export type NormalizedProviderId = "openai" | "openai-codex" | "mock";

export type PlannerRuntimeApiKind =
  | "openai-responses"
  | "openai-codex-responses"
  | "experimental-codex-cli-bridge"
  | "mock";

export interface PlannerRuntimeTargetInput {
  modelRef?: string;
  provider?: string;
  model?: string;
  runtimeApiKind?: string;
  authProfileId?: string;
  legacyBrainProvider?: string;
  legacyBrainModel?: string;
}

export interface PlannerRuntimeTarget {
  providerId: NormalizedProviderId;
  modelId: string;
  modelRef: string;
  runtimeApiKind: PlannerRuntimeApiKind;
  authProfileId?: string;
  source: "model-ref" | "provider-model" | "legacy-brain";
}

function normalizeProviderId(input?: string): NormalizedProviderId | undefined {
  const normalized = input?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "mock") {
    return "mock";
  }
  if (normalized === "codex" || normalized === "codex-cli" || normalized === "openai-codex") {
    return "openai-codex";
  }
  if (normalized === "openai") {
    return "openai";
  }
  throw new Error(`Unsupported planner provider "${input}".`);
}

function parseModelRef(input: string): { providerId: NormalizedProviderId; modelId: string } {
  const trimmed = input.trim();
  const parts = trimmed.split("/");
  if (parts.length !== 2) {
    throw new Error(`Planner model ref "${input}" must look like "provider/model".`);
  }
  const providerId = normalizeProviderId(parts[0]);
  const modelId = parts[1]?.trim();
  if (!providerId || !modelId) {
    throw new Error(`Planner model ref "${input}" must include both provider and model.`);
  }
  return { providerId, modelId };
}

function normalizeRuntimeApiKind(input?: string): PlannerRuntimeApiKind | undefined {
  const normalized = input?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (
    normalized === "openai-responses" ||
    normalized === "openai-codex-responses" ||
    normalized === "experimental-codex-cli-bridge" ||
    normalized === "mock"
  ) {
    return normalized;
  }
  throw new Error(`Unsupported planner runtime API kind "${input}".`);
}

function defaultRuntimeApiKind(providerId: NormalizedProviderId): PlannerRuntimeApiKind {
  if (providerId === "mock") {
    return "mock";
  }
  if (providerId === "openai") {
    return "openai-responses";
  }
  return "experimental-codex-cli-bridge";
}

function validateRuntimeCompatibility(providerId: NormalizedProviderId, runtimeApiKind: PlannerRuntimeApiKind): void {
  if (providerId === "mock" && runtimeApiKind !== "mock") {
    throw new Error(`Provider "${providerId}" only supports runtime API kind "mock".`);
  }
  if (providerId === "openai" && runtimeApiKind !== "openai-responses") {
    throw new Error(`Provider "${providerId}" only supports runtime API kind "openai-responses".`);
  }
  if (
    providerId === "openai-codex" &&
    runtimeApiKind !== "openai-codex-responses" &&
    runtimeApiKind !== "experimental-codex-cli-bridge"
  ) {
    throw new Error(
      `Provider "${providerId}" only supports runtime API kinds "openai-codex-responses" or "experimental-codex-cli-bridge".`
    );
  }
}

export function normalizePlannerRuntimeTarget(input: PlannerRuntimeTargetInput): PlannerRuntimeTarget {
  const explicitModelRef = input.modelRef?.trim();
  const explicitProvider = normalizeProviderId(input.provider);
  const explicitModel = input.model?.trim();
  const runtimeApiKind = normalizeRuntimeApiKind(input.runtimeApiKind);
  const authProfileId = input.authProfileId?.trim() || undefined;

  let providerId: NormalizedProviderId;
  let modelId: string;
  let source: PlannerRuntimeTarget["source"];

  if (explicitModelRef) {
    ({ providerId, modelId } = parseModelRef(explicitModelRef));
    source = "model-ref";
  } else if (explicitProvider || explicitModel) {
    providerId = explicitProvider ?? "openai-codex";
    modelId = explicitModel || input.legacyBrainModel?.trim() || "gpt-5.4";
    source = "provider-model";
  } else {
    providerId = normalizeProviderId(input.legacyBrainProvider) ?? "openai-codex";
    modelId = input.legacyBrainModel?.trim() || "gpt-5.4";
    source = "legacy-brain";
  }

  const resolvedRuntimeApiKind = runtimeApiKind ?? defaultRuntimeApiKind(providerId);
  validateRuntimeCompatibility(providerId, resolvedRuntimeApiKind);

  return {
    providerId,
    modelId,
    modelRef: `${providerId}/${modelId}`,
    runtimeApiKind: resolvedRuntimeApiKind,
    authProfileId,
    source
  };
}

