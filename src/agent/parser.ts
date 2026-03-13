import type { ComputerAction } from "../executor/types.ts";

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

export function parseShellAction(args: string): ComputerAction | undefined {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return undefined;
  }
  return {
    type: "shell.command",
    command: parts[0],
    args: parts.slice(1)
  };
}

export function parseOpenUrlAction(args: string): ComputerAction | undefined {
  const url = args.trim();
  if (!url) {
    return undefined;
  }
  return {
    type: "browser.open_url",
    url
  };
}

export function parseAppleScriptAction(args: string): ComputerAction | undefined {
  const script = args.trim();
  if (!script) {
    return undefined;
  }
  return {
    type: "mac.applescript",
    script
  };
}
