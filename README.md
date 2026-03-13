# LobsterMind

LobsterMind (`龙虾参谋`) is a realistic MVP for a personal agent that can:

- remember notes in a local memory store,
- register and expose skills,
- receive inbound messages through a Feishu long-connection runtime, webhook, or local CLI,
- request computer actions through a well-defined executor layer with approval gating.

This repository intentionally avoids fake autonomous "computer use". Actions go through explicit tool adapters, risk classification, and a persisted approval queue.

## MVP architecture

- `src/agent/`: command routing and minimal agent orchestration
- `src/memory/`: JSON-backed memory store
- `src/skills/`: skill registry and built-in skills
- `src/executor/`: action types, adapters, risk policy, and approvals
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

6. Test the Feishu long-connection stub:

```bash
npm run cli -- feishu-stub ou_demo "/skills"
tail -f data/feishu-stub-outbox.jsonl
```

7. Inspect and approve pending actions:

```bash
npm run cli -- approvals
npm run cli -- approve <approval-id>
```

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

Real mode is an honest MVP integration point. It requires Feishu app credentials and a long-connection websocket endpoint:

- `LOBSTERMIND_FEISHU_LONG_CONNECTION_MODE=real`
- `LOBSTERMIND_FEISHU_APP_ID`
- `LOBSTERMIND_FEISHU_APP_SECRET`
- `LOBSTERMIND_FEISHU_WS_URL`

What the runtime does in real mode:

- fetches a tenant access token from Feishu
- opens a websocket to `LOBSTERMIND_FEISHU_WS_URL`
- parses inbound text events into the existing agent router
- sends text replies back through Feishu's IM API

This avoids hardcoding deployment-specific websocket assumptions into the repo. If your Feishu setup uses a relay or a different long-connection URL, provide that URL directly.

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
- `/remember <text>`
- `/memories [query]`
- `/run <shell command>`
- `/open-app <app name>`
- `/open-url <https://...>`
- `/applescript <script>`
- `/approvals`
- `/approve <id>`
- `/reject <id>`

## Safety model

Approval mode is controlled by `LOBSTERMIND_APPROVAL_MODE`:

- `never`: execute everything immediately
- `dangerous`: auto-run low-risk actions, require approval for medium/high risk
- `always`: require approval for every executor action

Built-in actions are explicit:

- `shell.command`
- `desktop.open_app`
- `browser.open_url`
- `mac.applescript`

Risk controls in this MVP:

- allowlist-based shell execution by base command with a timeout
- browser URL opening separated from shell execution
- AppleScript always classified as high risk
- persisted approval records before dangerous execution
- clear separation between agent intent and adapter execution
- no hidden browser automation or unbounded OS control

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

## Docs

- Product vision: [docs/product-vision.md](/Users/levy/.openclaw/workspace/lobstermind/docs/product-vision.md)
