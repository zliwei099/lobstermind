import path from "node:path";
import type { ApprovalMode, AppConfig } from "../config.ts";
import type { CapabilityRequest, ExecutionProfile, RiskLevel } from "./types.ts";

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

export function isProfileEnabled(config: AppConfig, profile: ExecutionProfile): boolean {
  return config.allowedExecutionProfiles.includes(profile);
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

export function isPathInRoots(candidatePath: string, roots: string[]): boolean {
  const resolved = path.resolve(candidatePath);
  return roots.some((root) => {
    const resolvedRoot = path.resolve(root);
    return resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}${path.sep}`);
  });
}

export function getWritableRoots(config: AppConfig): string[] {
  return [config.workspaceRoot, config.dataDir];
}

export function summarizeEnvKeys(request: Extract<CapabilityRequest, { capability: "shell.exec" }>): string {
  const keys = Object.keys(request.input.env ?? {});
  return keys.length === 0 ? "no env overrides" : `env overrides: ${keys.join(", ")}`;
}

export function classifyShellRisk(
  request: Extract<CapabilityRequest, { capability: "shell.exec" }>,
  config: AppConfig
): { risk: RiskLevel; reason: string } {
  if (!config.shellAllowlist.includes(request.input.command)) {
    return {
      risk: "high",
      reason: `Command "${request.input.command}" is not in the configured shell allowlist.`
    };
  }

  if (HIGH_RISK_COMMANDS.has(request.input.command)) {
    return {
      risk: "high",
      reason: `Command "${request.input.command}" is classified as high risk.`
    };
  }

  if (request.input.cwd && !isPathInRoots(request.input.cwd, getWritableRoots(config))) {
    return {
      risk: "high",
      reason: `cwd "${request.input.cwd}" is outside the workspace/data roots.`
    };
  }

  const envKeys = Object.keys(request.input.env ?? {});
  const disallowedKey = envKeys.find((key) => !config.shellEnvAllowlist.includes(key));
  if (disallowedKey) {
    return {
      risk: "high",
      reason: `Environment key "${disallowedKey}" is not in the allowed shell env subset.`
    };
  }

  if (request.input.cwd || envKeys.length > 0) {
    return {
      risk: "medium",
      reason: `Shell execution changes execution context with ${request.input.cwd ? "custom cwd" : summarizeEnvKeys(request)}.`
    };
  }

  return {
    risk: "low",
    reason: `Command "${request.input.command}" is allowlisted and uses the default execution context.`
  };
}

export function classifyProcessRisk(
  request: Extract<CapabilityRequest, { capability: "process.run" | "process.run_background" }>,
  config: AppConfig
): { risk: RiskLevel; reason: string } {
  if (!request.input.command.trim()) {
    return {
      risk: "high",
      reason: "A process command is required."
    };
  }

  if (request.input.cwd && !isPathInRoots(request.input.cwd, getWritableRoots(config))) {
    return {
      risk: "high",
      reason: `cwd "${request.input.cwd}" is outside the workspace/data roots.`
    };
  }

  const envKeys = Object.keys(request.input.env ?? {});
  const disallowedKey = envKeys.find((key) => !config.shellEnvAllowlist.includes(key));
  if (disallowedKey) {
    return {
      risk: "high",
      reason: `Environment key "${disallowedKey}" is not in the allowed process env subset.`
    };
  }

  const base = path.basename(request.input.command);
  if (HIGH_RISK_COMMANDS.has(base)) {
    return {
      risk: "high",
      reason: `Command "${base}" is classified as high risk.`
    };
  }

  if (request.capability === "process.run_background") {
    return {
      risk: "high",
      reason: "Background processes can outlive the request and are treated as high risk."
    };
  }

  if (request.input.cwd || envKeys.length > 0) {
    return {
      risk: "high",
      reason: "Process execution with custom cwd or env is treated as high risk."
    };
  }

  return {
    risk: "medium",
    reason: `Process "${base}" is not allowlisted like shell.exec and is treated as medium risk.`
  };
}
