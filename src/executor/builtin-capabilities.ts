import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "../config.ts";
import { CapabilityRegistry, type CapabilityContext, type CapabilityDefinition } from "./capability-registry.ts";
import { LocalFsAdapter } from "./adapters/local-fs-adapter.ts";
import { MacAppleScriptAdapter } from "./adapters/mac-applescript-adapter.ts";
import { MacFrontmostAppAdapter } from "./adapters/mac-frontmost-app-adapter.ts";
import { MacOpenAppAdapter } from "./adapters/mac-open-app-adapter.ts";
import { MacOpenUrlAdapter } from "./adapters/mac-open-url-adapter.ts";
import { LocalShellAdapter } from "./adapters/local-shell-adapter.ts";
import { classifyShellRisk, getWritableRoots, isPathInRoots, isProfileEnabled, requiresApproval } from "./policy.ts";
import type { CapabilityRequest, ExecutionProfile, PolicyEvaluation } from "./types.ts";

type ShellExecRequest = Extract<CapabilityRequest, { capability: "shell.exec" }>;
type OpenAppRequest = Extract<CapabilityRequest, { capability: "desktop.open_app" }>;
type OpenUrlRequest = Extract<CapabilityRequest, { capability: "browser.open_url" }>;
type AppleScriptRequest = Extract<CapabilityRequest, { capability: "mac.applescript" }>;
type FsReadRequest = Extract<CapabilityRequest, { capability: "fs.read" }>;
type FsWriteRequest = Extract<CapabilityRequest, { capability: "fs.write" }>;
type FrontmostAppRequest = Extract<CapabilityRequest, { capability: "os.frontmost_app" }>;

function validateProfile<TRequest extends CapabilityRequest>(
  definition: CapabilityDefinition<TRequest>,
  requestedProfile: ExecutionProfile | undefined,
  config: AppConfig
): PolicyEvaluation | undefined {
  const profile = requestedProfile ?? definition.defaultProfile;
  if (!definition.supportedProfiles.includes(profile)) {
    return {
      status: "denied",
      profile,
      risk: "high",
      reason: `Capability "${definition.id}" does not support the "${profile}" profile.`
    };
  }
  if (!isProfileEnabled(config, profile)) {
    return {
      status: "denied",
      profile,
      risk: "high",
      reason: `Execution profile "${profile}" is disabled by configuration.`
    };
  }
  return undefined;
}

function decision(profile: ExecutionProfile, risk: PolicyEvaluation["risk"], reason: string, config: AppConfig): PolicyEvaluation {
  return {
    status: requiresApproval(config.approvalMode, risk) ? "needs_approval" : "allowed",
    profile,
    risk,
    reason
  };
}

function isReadablePath(inputPath: string, context: CapabilityContext): boolean {
  return fs.existsSync(inputPath) && isPathInRoots(inputPath, getWritableRoots(context.config));
}

export function createBuiltinCapabilityRegistry(
  _config: AppConfig,
  shellAdapter: LocalShellAdapter,
  openAppAdapter: MacOpenAppAdapter,
  openUrlAdapter: MacOpenUrlAdapter,
  appleScriptAdapter: MacAppleScriptAdapter,
  fsAdapter: LocalFsAdapter,
  frontmostAppAdapter: MacFrontmostAppAdapter
): CapabilityRegistry {
  const registry = new CapabilityRegistry();

  const shellExecCapability: CapabilityDefinition<ShellExecRequest> = {
    id: "shell.exec",
    description: "Execute an allowlisted local process with structured argv, cwd, and env overrides.",
    supportedProfiles: ["workspace-write", "dangerous"],
    defaultProfile: "workspace-write",
    summarize(request) {
      const argv = request.input.argv.join(" ");
      const suffix = request.input.cwd ? ` (cwd=${request.input.cwd})` : "";
      return `${request.input.command}${argv ? ` ${argv}` : ""}${suffix}`;
    },
    evaluatePolicy(request, context) {
      const profileCheck = validateProfile(this, request.requestedProfile, context.config);
      if (profileCheck) {
        return profileCheck;
      }
      const profile = request.requestedProfile ?? this.defaultProfile;
      const shellRisk = classifyShellRisk(request, context.config);
      if (
        shellRisk.reason.includes("not in the configured shell allowlist") ||
        shellRisk.reason.includes("outside the workspace/data roots") ||
        shellRisk.reason.includes("not in the allowed shell env subset")
      ) {
        return {
          status: "denied",
          profile,
          risk: shellRisk.risk,
          reason: shellRisk.reason
        };
      }
      return decision(profile, shellRisk.risk, shellRisk.reason, context.config);
    },
    execute(request) {
      return shellAdapter.execute(request.input);
    }
  };

  const openAppCapability: CapabilityDefinition<OpenAppRequest> = {
    id: "desktop.open_app",
    description: "Open a local desktop application by bundle-visible app name.",
    supportedProfiles: ["desktop-safe", "dangerous"],
    defaultProfile: "desktop-safe",
    summarize(request) {
      return `open app "${request.input.appName}"`;
    },
    evaluatePolicy(request, context) {
      const profileCheck = validateProfile(this, request.requestedProfile, context.config);
      if (profileCheck) {
        return profileCheck;
      }
      const profile = request.requestedProfile ?? this.defaultProfile;
      if (!request.input.appName.trim()) {
        return {
          status: "denied",
          profile,
          risk: "high",
          reason: "App name is required."
        };
      }
      return decision(profile, "medium", "Opening desktop applications affects the local machine state.", context.config);
    },
    execute(request) {
      return openAppAdapter.execute(request.input);
    }
  };

  const openUrlCapability: CapabilityDefinition<OpenUrlRequest> = {
    id: "browser.open_url",
    description: "Open an HTTP or HTTPS URL in the default browser.",
    supportedProfiles: ["desktop-safe", "dangerous"],
    defaultProfile: "desktop-safe",
    summarize(request) {
      return `open URL "${request.input.url}"`;
    },
    evaluatePolicy(request, context) {
      const profileCheck = validateProfile(this, request.requestedProfile, context.config);
      if (profileCheck) {
        return profileCheck;
      }
      const profile = request.requestedProfile ?? this.defaultProfile;
      try {
        const url = new URL(request.input.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return {
            status: "denied",
            profile,
            risk: "high",
            reason: `Protocol "${url.protocol}" is not permitted for browser.open_url.`
          };
        }
      } catch {
        return {
          status: "denied",
          profile,
          risk: "high",
          reason: "Invalid URL."
        };
      }
      return decision(
        profile,
        "medium",
        "Opening a browser URL is user-visible and may trigger side effects on the local machine.",
        context.config
      );
    },
    execute(request) {
      return openUrlAdapter.execute(request.input);
    }
  };

  const appleScriptCapability: CapabilityDefinition<AppleScriptRequest> = {
    id: "mac.applescript",
    description: "Run AppleScript directly through osascript.",
    supportedProfiles: ["dangerous"],
    defaultProfile: "dangerous",
    summarize(request) {
      return `run AppleScript "${request.input.script}"`;
    },
    evaluatePolicy(request, context) {
      const profileCheck = validateProfile(this, request.requestedProfile, context.config);
      if (profileCheck) {
        return profileCheck;
      }
      const profile = request.requestedProfile ?? this.defaultProfile;
      if (!request.input.script.trim()) {
        return {
          status: "denied",
          profile,
          risk: "high",
          reason: "AppleScript source is required."
        };
      }
      return decision(profile, "high", "AppleScript can automate arbitrary local UI and is always high risk.", context.config);
    },
    execute(request) {
      return appleScriptAdapter.execute(request.input);
    }
  };

  const fsReadCapability: CapabilityDefinition<FsReadRequest> = {
    id: "fs.read",
    description: "Read a file from the workspace or data directory.",
    supportedProfiles: ["readonly", "workspace-write", "dangerous"],
    defaultProfile: "readonly",
    summarize(request) {
      return `read file "${path.resolve(request.input.path)}"`;
    },
    evaluatePolicy(request, context) {
      const profileCheck = validateProfile(this, request.requestedProfile, context.config);
      if (profileCheck) {
        return profileCheck;
      }
      const profile = request.requestedProfile ?? this.defaultProfile;
      if (!isReadablePath(request.input.path, context)) {
        return {
          status: "denied",
          profile,
          risk: "high",
          reason: "fs.read is limited to existing files under the workspace or data directory."
        };
      }
      return decision(profile, "low", "Reading an existing workspace/data file is treated as low risk.", context.config);
    },
    execute(request) {
      return fsAdapter.read(request.input);
    }
  };

  const fsWriteCapability: CapabilityDefinition<FsWriteRequest> = {
    id: "fs.write",
    description: "Write a text file under the workspace or data directory.",
    supportedProfiles: ["workspace-write", "dangerous"],
    defaultProfile: "workspace-write",
    summarize(request) {
      return `write file "${path.resolve(request.input.path)}"`;
    },
    evaluatePolicy(request, context) {
      const profileCheck = validateProfile(this, request.requestedProfile, context.config);
      if (profileCheck) {
        return profileCheck;
      }
      const profile = request.requestedProfile ?? this.defaultProfile;
      if (!isPathInRoots(request.input.path, getWritableRoots(context.config))) {
        return {
          status: "denied",
          profile,
          risk: "high",
          reason: "fs.write is limited to the workspace and data directories."
        };
      }
      return decision(profile, "medium", "Writing files changes local state and is treated as medium risk.", context.config);
    },
    execute(request) {
      return fsAdapter.write(request.input);
    }
  };

  const frontmostAppCapability: CapabilityDefinition<FrontmostAppRequest> = {
    id: "os.frontmost_app",
    description: "Inspect the frontmost macOS app via System Events.",
    supportedProfiles: ["readonly", "desktop-safe"],
    defaultProfile: "readonly",
    summarize() {
      return "inspect frontmost app";
    },
    evaluatePolicy(request, context) {
      const profileCheck = validateProfile(this, request.requestedProfile, context.config);
      if (profileCheck) {
        return profileCheck;
      }
      const profile = request.requestedProfile ?? this.defaultProfile;
      return decision(profile, "low", "Inspecting the frontmost app is treated as low risk.", context.config);
    },
    execute(request) {
      return frontmostAppAdapter.execute(request.input);
    }
  };

  registry.register(shellExecCapability);
  registry.register(openAppCapability);
  registry.register(openUrlCapability);
  registry.register(appleScriptCapability);
  registry.register(fsReadCapability);
  registry.register(fsWriteCapability);
  registry.register(frontmostAppCapability);

  return registry;
}
