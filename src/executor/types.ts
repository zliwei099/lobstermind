export type CapabilityId =
  | "shell.exec"
  | "desktop.open_app"
  | "browser.open_url"
  | "mac.applescript"
  | "fs.read"
  | "fs.write"
  | "fs.list"
  | "fs.stat"
  | "fs.append"
  | "fs.mkdir"
  | "os.frontmost_app"
  | "os.screenshot"
  | "process.run"
  | "process.run_background"
  | "process.list"
  | "process.kill";

export type ExecutionProfile = "readonly" | "workspace-write" | "desktop-safe" | "dangerous";
export type RiskLevel = "low" | "medium" | "high";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "executed";
export type AuditEventType =
  | "requested"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "denied"
  | "executed";

export interface ShellExecInput {
  command: string;
  argv: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface OpenAppInput {
  appName: string;
}

export interface OpenUrlInput {
  url: string;
}

export interface AppleScriptInput {
  script: string;
}

export interface FsReadInput {
  path: string;
  encoding?: BufferEncoding;
}

export interface FsWriteInput {
  path: string;
  content: string;
  encoding?: BufferEncoding;
}

export interface FsListInput {
  path: string;
  includeHidden?: boolean;
}

export interface FsStatInput {
  path: string;
}

export interface FsAppendInput {
  path: string;
  content: string;
  encoding?: BufferEncoding;
}

export interface FsMkdirInput {
  path: string;
  recursive?: boolean;
}

export interface FrontmostAppInput {
  includeBundleId?: boolean;
}

export interface ScreenshotInput {
  path?: string;
  format?: "png" | "jpg";
}

export interface ProcessRunInput {
  command: string;
  argv: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface ProcessListInput {
  limit?: number;
}

export interface ProcessKillInput {
  pid: number;
  signal?: NodeJS.Signals;
}

export interface CapabilityInputMap {
  "shell.exec": ShellExecInput;
  "desktop.open_app": OpenAppInput;
  "browser.open_url": OpenUrlInput;
  "mac.applescript": AppleScriptInput;
  "fs.read": FsReadInput;
  "fs.write": FsWriteInput;
  "fs.list": FsListInput;
  "fs.stat": FsStatInput;
  "fs.append": FsAppendInput;
  "fs.mkdir": FsMkdirInput;
  "os.frontmost_app": FrontmostAppInput;
  "os.screenshot": ScreenshotInput;
  "process.run": ProcessRunInput;
  "process.run_background": ProcessRunInput;
  "process.list": ProcessListInput;
  "process.kill": ProcessKillInput;
}

export type CapabilityRequest =
  {
    [K in CapabilityId]: {
      capability: K;
      input: CapabilityInputMap[K];
      requestedProfile?: ExecutionProfile;
      metadata?: {
        sourceCommand?: string;
        note?: string;
      };
    };
  }[CapabilityId];

export interface ApprovalRequest {
  id: string;
  senderId: string;
  createdAt: string;
  request: CapabilityRequest;
  capability: CapabilityId;
  profile: ExecutionProfile;
  risk: RiskLevel;
  status: ApprovalStatus;
  reason: string;
  resolvedAt?: string;
}

export interface ExecutionResult {
  ok: boolean;
  output: string;
  data?: unknown;
}

export interface PolicyEvaluation {
  status: "allowed" | "needs_approval" | "denied";
  profile: ExecutionProfile;
  risk: RiskLevel;
  reason: string;
}

export interface AuditEntry {
  id: string;
  createdAt: string;
  event: AuditEventType;
  senderId: string;
  capability: CapabilityId;
  profile: ExecutionProfile;
  risk: RiskLevel;
  reason: string;
  request: CapabilityRequest;
  approvalId?: string;
  result?: {
    ok: boolean;
    output: string;
  };
}

export interface ExecutionDecision {
  state: "executed" | "pending_approval" | "denied";
  result?: ExecutionResult;
  approval?: ApprovalRequest;
  reason?: string;
}
