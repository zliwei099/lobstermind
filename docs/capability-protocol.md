# Capability Protocol

LobsterMind now routes machine-side operations through a generic capability protocol instead of hard-coding each command into the executor.

## Why this exists

The earlier MVP had a small set of direct action types and a switch statement:

- `shell.command`
- `desktop.open_app`
- `browser.open_url`
- `mac.applescript`

That worked for a demo, but it encouraged command-specific branching and mixed together three different concerns:

- how the agent asks for work,
- how policy decides whether that work is allowed,
- how an adapter performs the work.

The new design separates those concerns.

## Core model

Each executable request is a structured payload:

```json
{
  "capability": "shell.exec",
  "input": {
    "command": "ls",
    "argv": ["-la"],
    "cwd": "/Users/levy/.openclaw/workspace/lobstermind"
  },
  "requestedProfile": "workspace-write",
  "metadata": {
    "sourceCommand": "/run"
  }
}
```

The executor now does the same sequence for every capability:

1. Look up the capability definition in the registry.
2. Evaluate policy for the request and requested profile.
3. Write audit records for the request and the decision.
4. Either deny, queue approval, or execute through the adapter.

The natural-language layer sits above this. It does not execute anything itself. It only maps some Chinese and English phrases into the same structured requests that `/action` can submit.

The planner runtime now also exports a model-facing tool catalog from this registry so model providers can plan against the same capability surface the executor trusts.

## Execution profiles

Profiles are coarse permission buckets. They are not a real OS sandbox.

- `readonly`: inspect local state without writing it
- `workspace-write`: read/write within the workspace or data directory
- `desktop-safe`: user-visible desktop actions such as opening apps or URLs
- `dangerous`: actions that can automate or affect the machine more broadly

Profiles are capability-aware. For example:

- `fs.read` supports `readonly`
- `fs.write` supports `workspace-write`
- `fs.list` and `fs.stat` support `readonly`
- `fs.append` and `fs.mkdir` support `workspace-write`
- `os.screenshot` supports `desktop-safe`
- `process.run_background` and `process.kill` support only `dangerous`
- `mac.applescript` supports only `dangerous`

Config can disable profiles entirely with `LOBSTERMIND_ALLOWED_EXECUTION_PROFILES`.

## Policy model

Policy is still intentionally simple:

- approval mode decides whether `low`, `medium`, or `high` risk work auto-runs
- each capability definition contains its own policy evaluation logic
- shell execution still requires an allowlisted base command
- `fs.*` write-like operations are limited to the workspace and data roots
- screenshot output paths are limited to the workspace and data roots
- generic process execution is separate from `shell.exec`, is not shell-expanded, and uses stronger approval gating
- dangerous or invalid requests are denied and audited instead of silently falling through

This is safer because the policy engine sees the capability name, structured input, and requested profile before any adapter runs.

It is also more extensible because a new capability can be added by registering one definition instead of editing parser, risk switch, and executor dispatch separately.

## Built-in capabilities

- `shell.exec`
- `desktop.open_app`
- `browser.open_url`
- `mac.applescript`
- `fs.read`
- `fs.write`
- `fs.list`
- `fs.stat`
- `fs.append`
- `fs.mkdir`
- `os.frontmost_app`
- `os.screenshot`
- `process.run`
- `process.run_background`
- `process.list`
- `process.kill`

## Natural-language planning

The planner is intentionally small and inspectable:

- it matches a narrow set of file, URL, app, screenshot, and process intents
- it converts them into a single structured capability request
- it asks a clarification question when a required path, app name, pid, or command is missing
- it never sends raw shell text to the OS

When the optional planner runtime is enabled, model providers receive the exported tool catalog for the same capabilities. They can only return:

- one structured capability request
- a clarification
- a refusal
- an unsupported result

That keeps model-side planning separate from machine-side execution.

Examples of planner output:

```json
{
  "capability": "fs.list",
  "input": {
    "path": "."
  },
  "requestedProfile": "readonly",
  "metadata": {
    "sourceCommand": "nl"
  }
}
```

```json
{
  "capability": "process.run_background",
  "input": {
    "command": "python3",
    "argv": ["-m", "http.server", "8000"]
  },
  "requestedProfile": "dangerous",
  "metadata": {
    "sourceCommand": "nl",
    "note": "Planned from natural-language intent"
  }
}
```

## Audit log

Every request produces append-only audit entries in `data/audit-log.json`.

Example executed entry:

```json
{
  "event": "executed",
  "senderId": "user-1",
  "capability": "fs.read",
  "profile": "readonly",
  "risk": "low",
  "reason": "Reading an existing workspace/data file is treated as low risk.",
  "request": {
    "capability": "fs.read",
    "input": {
      "path": "README.md"
    }
  },
  "result": {
    "ok": true,
    "output": "Read /Users/levy/.openclaw/workspace/lobstermind/README.md."
  }
}
```

Example approval-required entry:

```json
{
  "event": "pending_approval",
  "senderId": "user-1",
  "capability": "browser.open_url",
  "profile": "desktop-safe",
  "risk": "medium",
  "reason": "Opening a browser URL is user-visible and may trigger side effects on the local machine.",
  "approvalId": "apr_12345678",
  "request": {
    "capability": "browser.open_url",
    "input": {
      "url": "https://openai.com"
    }
  }
}
```

## Honest limitations

This does not pretend to be a complete security model.

- Profiles are policy labels, not sandbox enforcement.
- `shell.exec` still uses direct process spawning, not a container.
- `process.run` and `process.run_background` also use direct local process spawning.
- `process.list` currently parses macOS/Unix-style `ps` output.
- `os.screenshot` uses the local macOS `screencapture` tool, so Screen Recording permission may still be required by the OS.
- `mac.applescript` remains high-risk and approval-gated.
- The generic `/action` command trusts caller-supplied JSON shape enough to stay lightweight; capability policy still validates and can deny it.

That tradeoff is deliberate: the code stays runnable and inspectable while moving the architecture toward a safer, more general protocol.
