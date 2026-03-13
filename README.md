# LobsterMind

LobsterMind (`龙虾参谋`) is a realistic MVP for a personal agent that can:

- remember notes in a local memory store,
- register and expose skills,
- receive inbound messages through a Feishu long-connection runtime, webhook, or local CLI,
- map common natural-language requests into structured capability requests with a rule-first planner plus optional Codex brain fallback,
- request computer actions through a capability registry, policy-driven executor, approval queue, and audit log.

This repository intentionally avoids fake autonomous "computer use". Actions go through explicit capability definitions, profile-aware policy checks, adapter dispatch, a persisted approval queue, and an audit trail.

## MVP architecture

- `src/agent/`: command routing and minimal agent orchestration
- `src/memory/`: JSON-backed memory store
- `src/skills/`: skill registry and built-in skills
- `src/executor/`: capability protocol, registry, policy evaluation, adapters, approvals, and audit logging
- `src/integrations/feishu/`: webhook parser plus long-connection runtime
- `src/main.ts`: desktop runtime entrypoint
- `src/server.ts`: optional HTTP entrypoint
- `src/cli.ts`: local end-to-end CLI for testing messages and approvals

## Requirements

- Node.js 22+ for native TypeScript execution via `--experimental-strip-types`
- Optional: `npm install` if you want `npm run build` with `tsc`

## Quick start

1. Copy config:

```bash
cp .env.example .env
```

2. Start the desktop runtime:

```bash
npm run dev
```

By default this starts:

- the local HTTP server on `127.0.0.1:8787`
- the Feishu long-connection stub watcher

3. Send a local message through the CLI:

```bash
npm run cli -- message user-1 "/remember favorite lunch is spicy noodles"
```

4. List memories:

```bash
npm run cli -- message user-1 "/memories"
```

5. Request a computer action that may need approval:

```bash
npm run cli -- message user-1 "/run ls -la"
```

6. Submit a raw capability request as JSON:

```bash
npm run cli -- message user-1 '/action {"capability":"fs.read","input":{"path":"README.md"}}'
```

7. Test the Feishu long-connection stub:

```bash
npm run cli -- feishu-stub ou_demo "/skills"
tail -f data/feishu-stub-outbox.jsonl
```

8. Inspect and approve pending actions:

```bash
npm run cli -- approvals
npm run cli -- audits
npm run cli -- approve <approval-id>
```

## Natural-language planner

Free-form messages now go through:

1. a lightweight rule-based planner for common intents
2. an optional brain layer for unmatched requests
3. memory/help fallback if no planner can produce a structured result

Both planners only emit structured capability requests or clarification questions. Execution still goes through the same policy, approval, and audit pipeline as `/action`.

Examples:

```bash
npm run cli -- message user-1 "read file README.md"
npm run cli -- message user-1 "列出当前目录文件"
npm run cli -- message user-1 'append "hello" to "data/notes.txt"'
npm run cli -- message user-1 '创建目录 "tmp/demo"'
npm run cli -- message user-1 "take a screenshot"
npm run cli -- message user-1 '后台运行 "python3 -m http.server 8000"'
npm run cli -- message user-1 "kill process 12345"
```

If a key argument is missing, the planner asks a clarification question instead of guessing.

## Brain layer

The optional brain layer lets LobsterMind call the local Codex CLI through its existing OAuth session and ask `gpt-5.4` to plan a structured capability request.

Key design constraints:

- the brain only plans, never executes
- output must be structured JSON
- all execution still flows through the capability protocol, policy checks, approvals, and audit log
- if the brain is disabled or unavailable, LobsterMind still runs with the rule-based planner alone

Config:

```dotenv
LOBSTERMIND_BRAIN_ENABLED=true
LOBSTERMIND_BRAIN_PROVIDER=codex
LOBSTERMIND_BRAIN_MODEL=gpt-5.4
```

For local testing without Codex, use:

```dotenv
LOBSTERMIND_BRAIN_PROVIDER=mock
```

Setup and examples:

- Brain + Codex OAuth guide: [docs/brain-codex.md](/Users/levy/.openclaw/workspace/lobstermind/docs/brain-codex.md)

## Feishu long connection

This repo now prefers `LOBSTERMIND_FEISHU_MODE=long-connection` for desktop use.

### Stub mode

Stub mode is the default because it is runnable without real Feishu credentials.

- `LOBSTERMIND_FEISHU_LONG_CONNECTION_MODE=stub`
- inbound events are read from `LOBSTERMIND_FEISHU_STUB_INBOX_PATH`
- replies are appended to `LOBSTERMIND_FEISHU_STUB_OUTBOX_PATH`

Queue a stub inbound message:

```bash
npm run cli -- feishu-stub ou_demo "/open-url https://www.feishu.cn"
```

Example inbox line format:

```json
{"header":{"event_type":"im.message.receive_v1"},"event":{"sender":{"sender_id":{"open_id":"ou_demo"}},"message":{"message_type":"text","content":"{\"text\":\"/skills\"}"}}}
```

### Real mode

Real mode now defaults to Feishu's official long-connection pattern through the Node SDK instead of assuming a raw websocket URL is enough.

- `LOBSTERMIND_FEISHU_LONG_CONNECTION_MODE=real`
- `LOBSTERMIND_FEISHU_LONG_CONNECTION_ADAPTER=official`
- `LOBSTERMIND_FEISHU_APP_ID`
- `LOBSTERMIND_FEISHU_APP_SECRET`
- run `npm install` so `@larksuiteoapi/node-sdk` is available

What the runtime does in real mode:

- fetches and caches a tenant access token from Feishu's auth API
- starts Feishu event subscription long-connection handling through the official Node SDK
- routes `im.message.receive_v1` text events into the existing agent
- replies through Feishu's IM API using `chat_id` when possible, then falls back to `open_id` or `user_id`
- rejects unsupported non-text messages with an explicit reply instead of silently dropping them

If you already have your own websocket relay that emits webhook-style Feishu event envelopes, you can still use it:

- `LOBSTERMIND_FEISHU_LONG_CONNECTION_ADAPTER=relay`
- `LOBSTERMIND_FEISHU_WS_URL=wss://...`

That relay path is intentionally documented as a custom transport, not Feishu's official long-connection protocol.

See the full setup guide here:

- Real setup: [docs/feishu-real-setup.md](/Users/levy/.openclaw/workspace/lobstermind/docs/feishu-real-setup.md)

## HTTP endpoints

The optional HTTP server exposes:

- `GET /health`
- `POST /feishu/webhook`
- `POST /agent/messages`
- `GET /approvals`
- `POST /approvals/:id/approve`
- `POST /approvals/:id/reject`

Minimal webhook example:

```bash
curl -X POST http://localhost:8787/feishu/webhook \
  -H "content-type: application/json" \
  -d '{
    "header": { "token": "" },
    "event": {
      "sender": { "sender_id": { "open_id": "ou_demo" } },
      "message": { "content": "{\"text\":\"/skills\"}" }
    }
  }'
```

For local testing, `POST /agent/messages` accepts a simpler payload:

```json
{
  "channel": "cli",
  "senderId": "user-1",
  "text": "/remember book dentist appointment"
}
```

## Commands

- `/help`
- `/skills`
- `/capabilities`
- `/remember <text>`
- `/memories [query]`
- `/run <shell command>`
- `/open-app <app name>`
- `/open-url <https://...>`
- `/applescript <script>`
- `/action <json-request>`
- `/approvals`
- `/audits`
- `/approve <id>`
- `/reject <id>`

## Safety model

Approval mode is controlled by `LOBSTERMIND_APPROVAL_MODE`:

- `never`: execute everything immediately
- `dangerous`: auto-run low-risk actions, require approval for medium/high risk
- `always`: require approval for every executor action

Execution profiles are controlled by `LOBSTERMIND_ALLOWED_EXECUTION_PROFILES`:

- `readonly`
- `workspace-write`
- `desktop-safe`
- `dangerous`

Built-in capabilities are explicit:

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

Risk controls in this MVP:

- structured shell execution with `command`, `argv`, optional `cwd`, and optional env subset
- natural-language planning limited to explicit, inspectable rules and structured request emission
- optional LLM planning constrained to a single structured JSON response and the registered capability set
- capability-specific policy evaluation before adapter execution
- allowlist-based shell execution by base command with a timeout
- profile-aware gating for readonly, workspace-write, desktop-safe, and dangerous operations
- browser URL opening separated from shell execution
- workspace/data-root enforcement for file writes, appends, mkdir, and screenshot output paths
- process execution split from `shell.exec`, with background runs and kill paths kept approval-gated
- AppleScript always classified as high risk
- persisted approval records before dangerous execution
- append-only audit entries for requests and policy/execution outcomes
- clear separation between agent intent, policy evaluation, and adapter execution
- no hidden browser automation or unbounded OS control

Example capability request:

```json
{
  "capability": "shell.exec",
  "input": {
    "command": "pwd",
    "argv": []
  },
  "requestedProfile": "workspace-write",
  "metadata": {
    "sourceCommand": "/run"
  }
}
```

Example audit entry:

```json
{
  "event": "pending_approval",
  "capability": "browser.open_url",
  "profile": "desktop-safe",
  "risk": "medium",
  "approvalId": "apr_12345678",
  "request": {
    "capability": "browser.open_url",
    "input": {
      "url": "https://openai.com"
    }
  }
}
```

## Build

If you want a compiled artifact:

```bash
npm install
npm run build
```

## Notes

- This repo is runnable with Node 22 directly through `node --experimental-strip-types ...`.
- In this build environment, opening a real HTTP listener was blocked by the sandbox (`listen EPERM`), so the CLI end-to-end path was used for execution smoke tests.
- Long-connection design note: [docs/feishu-long-connection.md](/Users/levy/.openclaw/workspace/lobstermind/docs/feishu-long-connection.md)
- Capability protocol: [docs/capability-protocol.md](/Users/levy/.openclaw/workspace/lobstermind/docs/capability-protocol.md)
- Brain + Codex OAuth: [docs/brain-codex.md](/Users/levy/.openclaw/workspace/lobstermind/docs/brain-codex.md)
- Real Feishu setup: [docs/feishu-real-setup.md](/Users/levy/.openclaw/workspace/lobstermind/docs/feishu-real-setup.md)

## Docs

- Product vision: [docs/product-vision.md](/Users/levy/.openclaw/workspace/lobstermind/docs/product-vision.md)
