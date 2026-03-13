import type { CapabilityRequest, ExecutionProfile } from "../executor/types.ts";
import type {
  PlannerDecision,
  PlannerDiagnostic,
  PlannerEnvelope,
  PlannerProviderDescriptor,
  PlannerRuntimeRequest,
  PlannerToolCatalog,
  PlannerToolDefinition
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeTextField(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} must not be empty.`);
  }
  return normalized;
}

function normalizeDecision(value: unknown): PlannerDecision {
  if (!isRecord(value)) {
    throw new Error("Planner decision must be an object.");
  }

  const kind = normalizeTextField(value.kind, "decision.kind").toLowerCase();
  if (kind === "request") {
    const request = value.request;
    if (!isRecord(request)) {
      throw new Error("decision.request must be an object.");
    }
    const capability = normalizeTextField(request.capability, "decision.request.capability");
    const input = request.input;
    if (!isRecord(input)) {
      throw new Error("decision.request.input must be an object.");
    }
    const requestedProfile =
      request.requestedProfile === undefined
        ? undefined
        : normalizeTextField(request.requestedProfile, "decision.request.requestedProfile");
    const metadata = request.metadata;
    let normalizedMetadata: CapabilityRequest["metadata"] | undefined;
    if (metadata !== undefined) {
      if (!isRecord(metadata)) {
        throw new Error("decision.request.metadata must be an object when provided.");
      }
      normalizedMetadata = {
        sourceCommand:
          metadata.sourceCommand === undefined
            ? undefined
            : normalizeTextField(metadata.sourceCommand, "decision.request.metadata.sourceCommand"),
        note:
          metadata.note === undefined
            ? undefined
            : normalizeTextField(metadata.note, "decision.request.metadata.note")
      };
    }
    return {
      kind: "request",
      request: {
        capability: capability as CapabilityRequest["capability"],
        input,
        requestedProfile: requestedProfile as ExecutionProfile | undefined,
        metadata: normalizedMetadata
      } as CapabilityRequest
    };
  }

  if (kind === "clarification") {
    const clarification = value.clarification;
    if (!isRecord(clarification)) {
      throw new Error("decision.clarification must be an object.");
    }
    return {
      kind: "clarification",
      clarification: {
        text: normalizeTextField(clarification.text, "decision.clarification.text")
      }
    };
  }

  if (kind === "refusal") {
    const refusal = value.refusal;
    if (!isRecord(refusal)) {
      throw new Error("decision.refusal must be an object.");
    }
    return {
      kind: "refusal",
      refusal: {
        text: normalizeTextField(refusal.text, "decision.refusal.text"),
        reason:
          refusal.reason === undefined ? undefined : normalizeTextField(refusal.reason, "decision.refusal.reason")
      }
    };
  }

  if (kind === "unsupported") {
    const unsupported = value.unsupported;
    if (!isRecord(unsupported)) {
      throw new Error("decision.unsupported must be an object.");
    }
    return {
      kind: "unsupported",
      unsupported: {
        text: normalizeTextField(unsupported.text, "decision.unsupported.text"),
        reason:
          unsupported.reason === undefined
            ? undefined
            : normalizeTextField(unsupported.reason, "decision.unsupported.reason")
      }
    };
  }

  throw new Error(`Unsupported decision kind "${kind}".`);
}

function normalizeDiagnostics(value: unknown): PlannerDiagnostic[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("diagnostics must be an array when provided.");
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`diagnostics[${index}] must be an object.`);
    }
    const level = normalizeTextField(entry.level, `diagnostics[${index}].level`).toLowerCase();
    if (level !== "info" && level !== "warning" && level !== "error") {
      throw new Error(`diagnostics[${index}].level must be info, warning, or error.`);
    }
    return {
      level,
      code: normalizeTextField(entry.code, `diagnostics[${index}].code`),
      message: normalizeTextField(entry.message, `diagnostics[${index}].message`)
    } as PlannerDiagnostic;
  });
}

export function normalizePlannerEnvelope(
  value: unknown,
  descriptor: PlannerProviderDescriptor,
  request: PlannerRuntimeRequest
): PlannerEnvelope {
  const base = isRecord(value) ? value : {};
  const decisionSource = "decision" in base ? base.decision : value;
  const diagnostics = normalizeDiagnostics(base.diagnostics);
  const traceId =
    base.traceId === undefined ? request.context.traceId : normalizeTextField(base.traceId, "traceId");

  return {
    version: "planner-envelope.v1",
    provider: descriptor,
    traceId,
    decision: normalizeDecision(decisionSource),
    diagnostics,
    rawOutput: value
  };
}

function toolByName(toolCatalog: PlannerToolCatalog, capability: string): PlannerToolDefinition | undefined {
  return toolCatalog.items.find((tool) => tool.name === capability);
}

export function validatePlannerEnvelope(envelope: PlannerEnvelope, request: PlannerRuntimeRequest): PlannerEnvelope {
  if (envelope.traceId !== request.context.traceId) {
    throw new Error(
      `Provider returned traceId "${envelope.traceId}" but request traceId was "${request.context.traceId}".`
    );
  }

  if (envelope.decision.kind !== "request") {
    return envelope;
  }

  const tool = toolByName(request.toolCatalog, envelope.decision.request.capability);
  if (!tool) {
    throw new Error(`Unknown capability "${envelope.decision.request.capability}".`);
  }

  const requestedProfile = envelope.decision.request.requestedProfile;
  if (requestedProfile && !tool.supportedProfiles.includes(requestedProfile)) {
    throw new Error(
      `Capability "${tool.name}" does not support requested profile "${requestedProfile}".`
    );
  }

  return envelope;
}

export function createUnsupportedEnvelope(
  descriptor: PlannerProviderDescriptor,
  request: PlannerRuntimeRequest,
  code: string,
  message: string,
  rawOutput?: unknown
): PlannerEnvelope {
  return {
    version: "planner-envelope.v1",
    provider: descriptor,
    traceId: request.context.traceId,
    decision: {
      kind: "unsupported",
      unsupported: {
        text: "The planner provider returned output that LobsterMind could not trust.",
        reason: code
      }
    },
    diagnostics: [
      {
        level: "error",
        code,
        message
      }
    ],
    rawOutput
  };
}
