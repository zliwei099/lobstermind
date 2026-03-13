export type ActionType =
  | "shell.command"
  | "desktop.open_app"
  | "browser.open_url"
  | "mac.applescript";
export type RiskLevel = "low" | "medium" | "high";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "executed";

export interface ShellCommandAction {
  type: "shell.command";
  command: string;
  args: string[];
}

export interface OpenAppAction {
  type: "desktop.open_app";
  appName: string;
}

export interface OpenUrlAction {
  type: "browser.open_url";
  url: string;
}

export interface AppleScriptAction {
  type: "mac.applescript";
  script: string;
}

export type ComputerAction = ShellCommandAction | OpenAppAction | OpenUrlAction | AppleScriptAction;

export interface ApprovalRequest {
  id: string;
  senderId: string;
  createdAt: string;
  action: ComputerAction;
  risk: RiskLevel;
  status: ApprovalStatus;
  reason: string;
  resolvedAt?: string;
}

export interface ExecutionResult {
  ok: boolean;
  output: string;
}
