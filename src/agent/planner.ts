import type { CapabilityRequest } from "../executor/types.ts";
import { tokenizeShellArgs } from "./parser.ts";

export type PlannerResult =
  | {
      kind: "request";
      request: CapabilityRequest;
    }
  | {
      kind: "clarification";
      text: string;
    }
  | {
      kind: "none";
    };

function quotedValue(text: string): string | undefined {
  const match = text.match(/["'`](.+?)["'`]/);
  return match?.[1]?.trim();
}

function findUrl(text: string): string | undefined {
  return text.match(/https?:\/\/\S+/i)?.[0];
}

function normalizeMaybePath(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim().replace(/[。？！,.]+$/u, "");
  if (!trimmed) {
    return undefined;
  }
  if (trimmed === "当前目录" || trimmed === "当前文件夹" || trimmed === "current directory" || trimmed === "current folder") {
    return ".";
  }
  return trimmed;
}

function extractPathAfterKeywords(text: string, keywords: string[]): string | undefined {
  for (const keyword of keywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`${escaped}\\s+(.+)$`, "i");
    const match = text.match(regex);
    if (match?.[1]) {
      return normalizeMaybePath(match[1]);
    }
  }
  return undefined;
}

function parseCommandPayload(raw: string): { command: string; argv: string[] } | undefined {
  const payload = raw.trim().replace(/^(command|cmd)\s+/i, "");
  if (!payload || /&&|\|\||[|;]/.test(payload)) {
    return undefined;
  }
  const tokens = tokenizeShellArgs(payload);
  if (tokens.length === 0) {
    return undefined;
  }
  return {
    command: tokens[0],
    argv: tokens.slice(1)
  };
}

function processRequest(
  capability: "process.run" | "process.run_background",
  payload: { command: string; argv: string[] }
): PlannerResult {
  return {
    kind: "request",
    request: {
      capability,
      input: payload,
      requestedProfile: capability === "process.run" ? "workspace-write" : "dangerous",
      metadata: {
        sourceCommand: "nl",
        note: "Planned from natural-language intent"
      }
    }
  };
}

export function planNaturalLanguage(text: string): PlannerResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { kind: "none" };
  }

  const lower = trimmed.toLowerCase();
  const quoted = quotedValue(trimmed);

  if (/(frontmost app|foreground app|which app is active|前台应用|当前应用)/i.test(trimmed)) {
    return {
      kind: "request",
      request: {
        capability: "os.frontmost_app",
        input: {},
        requestedProfile: "readonly",
        metadata: {
          sourceCommand: "nl"
        }
      }
    };
  }

  const url = findUrl(trimmed);
  if (url && /(open|visit|browse|打开|访问)/i.test(trimmed)) {
    return {
      kind: "request",
      request: {
        capability: "browser.open_url",
        input: { url },
        requestedProfile: "desktop-safe",
        metadata: {
          sourceCommand: "nl"
        }
      }
    };
  }

  if (/(open app|launch app|打开应用|启动应用|打开软件|启动软件)/i.test(trimmed)) {
    const appName = quoted ?? extractPathAfterKeywords(trimmed, ["open app", "launch app", "打开应用", "启动应用", "打开软件", "启动软件"]);
    if (!appName) {
      return {
        kind: "clarification",
        text: "Which app should I open? Example: 打开应用 \"Safari\"."
      };
    }
    return {
      kind: "request",
      request: {
        capability: "desktop.open_app",
        input: { appName },
        requestedProfile: "desktop-safe",
        metadata: {
          sourceCommand: "nl"
        }
      }
    };
  }

  if (/(screenshot|screen shot|截图)/i.test(trimmed)) {
    const outputPath = quoted ?? extractPathAfterKeywords(trimmed, ["to", "保存到", "save to"]);
    return {
      kind: "request",
      request: {
        capability: "os.screenshot",
        input: outputPath ? { path: outputPath } : {},
        requestedProfile: "desktop-safe",
        metadata: {
          sourceCommand: "nl"
        }
      }
    };
  }

  if (/(list processes|show processes|process list|查看进程|列出进程|进程列表|\bps\b)/i.test(lower)) {
    return {
      kind: "request",
      request: {
        capability: "process.list",
        input: {},
        requestedProfile: "readonly",
        metadata: {
          sourceCommand: "nl"
        }
      }
    };
  }

  const killMatch = trimmed.match(/(?:kill process|terminate process|stop process|结束进程|杀掉进程|kill)\s+#?(\d+)/i);
  if (killMatch) {
    return {
      kind: "request",
      request: {
        capability: "process.kill",
        input: {
          pid: Number(killMatch[1])
        },
        requestedProfile: "dangerous",
        metadata: {
          sourceCommand: "nl"
        }
      }
    };
  }

  if (/(run in background|start in background|后台运行|后台启动)/i.test(trimmed)) {
    const commandText = quoted ?? trimmed.replace(/.*?(run in background|start in background|后台运行|后台启动)\s*/i, "");
    const payload = parseCommandPayload(commandText);
    if (!payload) {
      return {
        kind: "clarification",
        text: "I need a plain command plus argv for the background process. Example: 后台运行 \"python3 -m http.server 8000\"."
      };
    }
    return processRequest("process.run_background", payload);
  }

  if (/(run process|start process|运行命令|运行进程|执行进程)/i.test(trimmed)) {
    const commandText = quoted ?? trimmed.replace(/.*?(run process|start process|运行命令|运行进程|执行进程)\s*/i, "");
    const payload = parseCommandPayload(commandText);
    if (!payload) {
      return {
        kind: "clarification",
        text: "I need a plain command plus argv. Example: run process \"python3 --version\"."
      };
    }
    return processRequest("process.run", payload);
  }

  if (
    /(list files|show files|ls\b|dir\b|列出文件|查看目录|列出目录)/i.test(lower) ||
    (/列出/i.test(trimmed) && /(文件|目录|文件夹)/.test(trimmed))
  ) {
    const targetPath =
      quoted ??
      extractPathAfterKeywords(trimmed, ["in", "under", "目录", "文件夹", "path"]) ??
      (/(current directory|current folder|当前目录|当前文件夹)/i.test(trimmed) ? "." : undefined) ??
      ".";
    return {
      kind: "request",
      request: {
        capability: "fs.list",
        input: { path: targetPath },
        requestedProfile: "readonly",
        metadata: {
          sourceCommand: "nl"
        }
      }
    };
  }

  if (/(stat file|file info|metadata|文件信息|文件属性|查看属性)/i.test(trimmed)) {
    const targetPath = quoted ?? extractPathAfterKeywords(trimmed, ["for", "of", "文件", "path"]);
    if (!targetPath) {
      return {
        kind: "clarification",
        text: "Which file or directory should I inspect? Example: 查看属性 \"README.md\"."
      };
    }
    return {
      kind: "request",
      request: {
        capability: "fs.stat",
        input: { path: targetPath },
        requestedProfile: "readonly",
        metadata: {
          sourceCommand: "nl"
        }
      }
    };
  }

  if (/(read file|show file|cat\b|读取文件|查看文件|打开文件)/i.test(trimmed)) {
    const targetPath = quoted ?? extractPathAfterKeywords(trimmed, ["read file", "show file", "cat", "读取文件", "查看文件", "打开文件"]);
    if (!targetPath) {
      return {
        kind: "clarification",
        text: "Which file should I read? Example: read file \"README.md\"."
      };
    }
    return {
      kind: "request",
      request: {
        capability: "fs.read",
        input: { path: targetPath },
        requestedProfile: "readonly",
        metadata: {
          sourceCommand: "nl"
        }
      }
    };
  }

  if (/(make directory|create directory|create folder|mkdir\b|创建目录|新建目录|创建文件夹)/i.test(trimmed)) {
    const targetPath = quoted ?? extractPathAfterKeywords(trimmed, ["make directory", "create directory", "create folder", "mkdir", "创建目录", "新建目录", "创建文件夹"]);
    if (!targetPath) {
      return {
        kind: "clarification",
        text: "Which directory should I create? Example: 创建目录 \"tmp/demo\"."
      };
    }
    return {
      kind: "request",
      request: {
        capability: "fs.mkdir",
        input: { path: targetPath, recursive: true },
        requestedProfile: "workspace-write",
        metadata: {
          sourceCommand: "nl"
        }
      }
    };
  }

  const appendMatch = trimmed.match(/(?:append|add)\s+["'`](.+?)["'`]\s+(?:to|into)\s+(?:file\s+)?["'`](.+?)["'`]/i);
  const appendCnMatch = trimmed.match(/(?:向|往)\s+["'`](.+?)["'`]\s+(?:追加|附加)\s+["'`](.+?)["'`]/i);
  if (appendMatch || appendCnMatch) {
    const content = appendMatch?.[1] ?? appendCnMatch?.[2];
    const targetPath = appendMatch?.[2] ?? appendCnMatch?.[1];
    return {
      kind: "request",
      request: {
        capability: "fs.append",
        input: {
          path: targetPath ?? "",
          content: content ?? ""
        },
        requestedProfile: "workspace-write",
        metadata: {
          sourceCommand: "nl"
        }
      }
    };
  }
  if (/(append|追加|附加)/i.test(trimmed)) {
    return {
      kind: "clarification",
      text: "Tell me both the file path and the text to append. Example: append \"hello\" to \"notes.txt\"."
    };
  }

  if (/(write file|save file|写入文件|保存文件)/i.test(trimmed)) {
    return {
      kind: "clarification",
      text: "Natural-language writing is limited right now. Use /action with fs.write for full file contents, or ask me to append text instead."
    };
  }

  return { kind: "none" };
}
