import type { ApprovalMode } from "../config.ts";
import type { ComputerAction, RiskLevel } from "./types.ts";

const HIGH_RISK_COMMANDS = new Set([
  "rm",
  "mv",
  "sudo",
  "chmod",
  "chown",
  "pkill",
  "kill",
  "osascript",
  "curl",
  "wget"
]);

export function classifyRisk(action: ComputerAction): { risk: RiskLevel; reason: string } {
  if (action.type === "desktop.open_app") {
    return {
      risk: "medium",
      reason: "Opening desktop applications affects the local machine state."
    };
  }

  if (action.type === "browser.open_url") {
    let protocol = "";
    try {
      protocol = new URL(action.url).protocol;
    } catch {
      return {
        risk: "high",
        reason: "Invalid URLs are blocked until reviewed."
      };
    }

    if (protocol === "http:" || protocol === "https:") {
      return {
        risk: "medium",
        reason: "Opening a browser URL is user-visible and may trigger side effects on the local machine."
      };
    }

    return {
      risk: "high",
      reason: `Protocol "${protocol}" is treated as high risk for browser open actions.`
    };
  }

  if (action.type === "mac.applescript") {
    return {
      risk: "high",
      reason: "AppleScript can automate arbitrary local UI and is always gated."
    };
  }

  const base = action.command.trim();
  if (HIGH_RISK_COMMANDS.has(base)) {
    return {
      risk: "high",
      reason: `Command "${base}" is classified as high risk.`
    };
  }

  return {
    risk: "low",
    reason: `Command "${base}" is allowlisted and considered low risk for this MVP.`
  };
}

export function requiresApproval(mode: ApprovalMode, risk: RiskLevel): boolean {
  if (mode === "always") {
    return true;
  }
  if (mode === "never") {
    return false;
  }
  return risk === "medium" || risk === "high";
}
