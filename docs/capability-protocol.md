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

## Execution profiles

Profiles are coarse permission buckets. They are not a real OS sandbox.

- `readonly`: inspect local state without writing it
- `workspace-write`: read/write within the workspace or data directory
- `desktop-safe`: user-visible desktop actions such as opening apps or URLs
- `dangerous`: actions that can automate or affect the machine more broadly

Profiles are capability-aware. For example:

- `fs.read` supports `readonly`
- `fs.write` supports `workspace-write`
- `mac.applescript` supports only `dangerous`

Config can disable profiles entirely with `LOBSTERMIND_ALLOWED_EXECUTION_PROFILES`.

## Policy model

Policy is still intentionally simple:

- approval mode decides whether `low`, `medium`, or `high` risk work auto-runs
- each capability definition contains its own policy evaluation logic
- shell execution still requires an allowlisted base command
- `fs.read` and `fs.write` are limited to the workspace and data roots
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
- `os.frontmost_app`

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
- `mac.applescript` remains high-risk and approval-gated.
- The generic `/action` command trusts caller-supplied JSON shape enough to stay lightweight; capability policy still validates and can deny it.

That tradeoff is deliberate: the code stays runnable and inspectable while moving the architecture toward a safer, more general protocol.
