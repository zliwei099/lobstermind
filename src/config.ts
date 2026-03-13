import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { ExecutionProfile } from "./executor/types.ts";
import {
  normalizePlannerRuntimeTarget,
  type NormalizedProviderId,
  type PlannerRuntimeApiKind,
  type PlannerRuntimeTarget
} from "./brain/runtime-target.ts";

export type ApprovalMode = "never" | "dangerous" | "always";
export type FeishuMode = "off" | "webhook" | "long-connection" | "hybrid";
export type FeishuLongConnectionMode = "off" | "stub" | "real";
export type FeishuLongConnectionAdapter = "official" | "relay";
export type BrainProvider = "codex-cli" | "mock" | NormalizedProviderId;

function parseDotEnv(contents: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries[key] = value.replace(/^['"]|['"]$/g, "");
  }
  return entries;
}

function loadEnvFile(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }
  const parsed = parseDotEnv(fs.readFileSync(envPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

function normalizeApprovalMode(input?: string): ApprovalMode {
  if (input === "never" || input === "dangerous" || input === "always") {
    return input;
  }
  return "dangerous";
}

function parseAllowlist(input?: string): string[] {
  return (input ?? "echo,pwd,ls,open")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseList(input: string | undefined, fallback: string): string[] {
  return (input ?? fallback)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseProfiles(input?: string): ExecutionProfile[] {
  const parsed = (input ?? "readonly,workspace-write,desktop-safe,dangerous")
    .split(",")
    .map((value) => value.trim()) as ExecutionProfile[];

  const valid = new Set<ExecutionProfile>(["readonly", "workspace-write", "desktop-safe", "dangerous"]);
  return parsed.filter((value): value is ExecutionProfile => valid.has(value));
}

function normalizeFeishuMode(input?: string): FeishuMode {
  if (input === "off" || input === "webhook" || input === "long-connection" || input === "hybrid") {
    return input;
  }
  return "long-connection";
}

function normalizeFeishuLongConnectionMode(input?: string): FeishuLongConnectionMode {
  if (input === "off" || input === "stub" || input === "real") {
    return input;
  }
  return "stub";
}

function normalizeFeishuLongConnectionAdapter(input?: string): FeishuLongConnectionAdapter {
  if (input === "official" || input === "relay") {
    return input;
  }
  return "official";
}

function parseBoolean(input: string | undefined, fallback: boolean): boolean {
  if (input === undefined) {
    return fallback;
  }
  return input === "true";
}

function legacyBrainProviderFromTarget(target: PlannerRuntimeTarget): BrainProvider {
  if (target.providerId === "mock") {
    return "mock";
  }
  if (target.runtimeApiKind === "experimental-codex-cli-bridge") {
    return "codex-cli";
  }
  return target.providerId;
}

export interface AppConfig {
  host: string;
  port: number;
  dataDir: string;
  approvalMode: ApprovalMode;
  httpEnabled: boolean;
  shellTimeoutMs: number;
  feishuVerificationToken?: string;
  feishuBotName: string;
  feishuMode: FeishuMode;
  feishuLongConnectionMode: FeishuLongConnectionMode;
  feishuLongConnectionAdapter: FeishuLongConnectionAdapter;
  feishuAppId?: string;
  feishuAppSecret?: string;
  feishuWsUrl?: string;
  feishuApiBaseUrl: string;
  feishuStubInboxPath: string;
  feishuStubOutboxPath: string;
  feishuStubPollMs: number;
  shellAllowlist: string[];
  shellEnvAllowlist: string[];
  workspaceRoot: string;
  allowedExecutionProfiles: ExecutionProfile[];
  plannerEnabled: boolean;
  plannerTarget: PlannerRuntimeTarget;
  plannerRuntimeApiKind: PlannerRuntimeApiKind;
  plannerModelRef: string;
  plannerAuthProfileId?: string;
  plannerCodexCommand: string;
  brainEnabled: boolean;
  brainProvider: BrainProvider;
  brainModel: string;
  brainCodexCommand: string;
}

export function loadConfig(): AppConfig {
  const plannerTarget = normalizePlannerRuntimeTarget({
    modelRef: process.env.LOBSTERMIND_PLANNER_MODEL_REF,
    provider: process.env.LOBSTERMIND_PLANNER_PROVIDER,
    model: process.env.LOBSTERMIND_PLANNER_MODEL,
    runtimeApiKind: process.env.LOBSTERMIND_PLANNER_RUNTIME_API,
    authProfileId: process.env.LOBSTERMIND_PLANNER_AUTH_PROFILE,
    legacyBrainProvider: process.env.LOBSTERMIND_BRAIN_PROVIDER,
    legacyBrainModel: process.env.LOBSTERMIND_BRAIN_MODEL
  });
  const plannerEnabled = parseBoolean(
    process.env.LOBSTERMIND_PLANNER_ENABLED ?? process.env.LOBSTERMIND_BRAIN_ENABLED,
    false
  );

  return {
    host: process.env.LOBSTERMIND_HOST || "127.0.0.1",
    port: Number(process.env.LOBSTERMIND_PORT ?? 8787),
    dataDir: path.resolve(process.cwd(), process.env.LOBSTERMIND_DATA_DIR ?? "./data"),
    approvalMode: normalizeApprovalMode(process.env.LOBSTERMIND_APPROVAL_MODE),
    httpEnabled: process.env.LOBSTERMIND_HTTP_ENABLED !== "false",
    shellTimeoutMs: Number(process.env.LOBSTERMIND_SHELL_TIMEOUT_MS ?? 15_000),
    feishuVerificationToken: process.env.LOBSTERMIND_FEISHU_VERIFICATION_TOKEN || undefined,
    feishuBotName: process.env.LOBSTERMIND_FEISHU_BOT_NAME || "LobsterMind",
    feishuMode: normalizeFeishuMode(process.env.LOBSTERMIND_FEISHU_MODE),
    feishuLongConnectionMode: normalizeFeishuLongConnectionMode(process.env.LOBSTERMIND_FEISHU_LONG_CONNECTION_MODE),
    feishuLongConnectionAdapter: normalizeFeishuLongConnectionAdapter(process.env.LOBSTERMIND_FEISHU_LONG_CONNECTION_ADAPTER),
    feishuAppId: process.env.LOBSTERMIND_FEISHU_APP_ID || undefined,
    feishuAppSecret: process.env.LOBSTERMIND_FEISHU_APP_SECRET || undefined,
    feishuWsUrl: process.env.LOBSTERMIND_FEISHU_WS_URL || undefined,
    feishuApiBaseUrl: process.env.LOBSTERMIND_FEISHU_API_BASE_URL || "https://open.feishu.cn/open-apis",
    feishuStubInboxPath: path.resolve(process.cwd(), process.env.LOBSTERMIND_FEISHU_STUB_INBOX_PATH ?? "./data/feishu-stub-inbox.jsonl"),
    feishuStubOutboxPath: path.resolve(process.cwd(), process.env.LOBSTERMIND_FEISHU_STUB_OUTBOX_PATH ?? "./data/feishu-stub-outbox.jsonl"),
    feishuStubPollMs: Number(process.env.LOBSTERMIND_FEISHU_STUB_POLL_MS ?? 2_000),
    shellAllowlist: parseAllowlist(process.env.LOBSTERMIND_SHELL_ALLOWLIST),
    shellEnvAllowlist: parseList(process.env.LOBSTERMIND_SHELL_ENV_ALLOWLIST, "PATH,HOME,TMPDIR"),
    workspaceRoot: path.resolve(process.cwd()),
    allowedExecutionProfiles: parseProfiles(process.env.LOBSTERMIND_ALLOWED_EXECUTION_PROFILES),
    plannerEnabled,
    plannerTarget,
    plannerRuntimeApiKind: plannerTarget.runtimeApiKind,
    plannerModelRef: plannerTarget.modelRef,
    plannerAuthProfileId: plannerTarget.authProfileId,
    plannerCodexCommand:
      process.env.LOBSTERMIND_PLANNER_CODEX_COMMAND ||
      process.env.LOBSTERMIND_BRAIN_CODEX_COMMAND ||
      "codex",
    brainEnabled: plannerEnabled,
    brainProvider: legacyBrainProviderFromTarget(plannerTarget),
    brainModel: plannerTarget.modelId,
    brainCodexCommand:
      process.env.LOBSTERMIND_PLANNER_CODEX_COMMAND ||
      process.env.LOBSTERMIND_BRAIN_CODEX_COMMAND ||
      "codex"
  };
}
