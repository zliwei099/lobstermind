import type { CapabilityRequest } from "../executor/types.ts";

export interface ParsedCommand {
  name: string;
  args: string;
}

export function parseCommand(text: string): ParsedCommand | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) {
    return undefined;
  }
  const firstSpace = trimmed.indexOf(" ");
  if (firstSpace === -1) {
    return {
      name: trimmed.slice(1),
      args: ""
    };
  }
  return {
    name: trimmed.slice(1, firstSpace),
    args: trimmed.slice(firstSpace + 1).trim()
  };
}

function tokenizeShellArgs(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  let escaping = false;

  for (const char of input.trim()) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaping || quote) {
    return [];
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

export function parseShellAction(args: string): CapabilityRequest | undefined {
  const parts = tokenizeShellArgs(args);
  if (parts.length === 0) {
    return undefined;
  }
  return {
    capability: "shell.exec",
    input: {
      command: parts[0],
      argv: parts.slice(1)
    },
    requestedProfile: "workspace-write",
    metadata: {
      sourceCommand: "/run"
    }
  };
}

export function parseOpenUrlAction(args: string): CapabilityRequest | undefined {
  const url = args.trim();
  if (!url) {
    return undefined;
  }
  return {
    capability: "browser.open_url",
    input: {
      url
    },
    requestedProfile: "desktop-safe",
    metadata: {
      sourceCommand: "/open-url"
    }
  };
}

export function parseAppleScriptAction(args: string): CapabilityRequest | undefined {
  const script = args.trim();
  if (!script) {
    return undefined;
  }
  return {
    capability: "mac.applescript",
    input: {
      script
    },
    requestedProfile: "dangerous",
    metadata: {
      sourceCommand: "/applescript"
    }
  };
}

export function parseActionRequest(args: string): CapabilityRequest | undefined {
  if (!args.trim()) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(args);
  } catch {
    return undefined;
  }

  if (!parsed || typeof parsed !== "object" || !("capability" in parsed) || !("input" in parsed)) {
    return undefined;
  }

  return parsed as CapabilityRequest;
}
